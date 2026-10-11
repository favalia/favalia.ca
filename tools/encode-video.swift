// Re-encodes a game preview for the web: no audio, smaller frame, H.264, fast start,
// and writes a JPEG poster frame.
//
//   swift tools/encode-video.swift <in> <out.mp4> <width> <kbps> <posterSeconds> <poster.jpg>
import AVFoundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard a.count == 7, let width = Int(a[3]), let kbps = Int(a[4]), let posterAt = Double(a[5]) else {
    print("usage: encode-video.swift <in> <out.mp4> <width> <kbps> <posterSeconds> <poster.jpg>"); exit(1)
}
let src = URL(fileURLWithPath: a[1]), dst = URL(fileURLWithPath: a[2]), posterURL = URL(fileURLWithPath: a[6])
try? FileManager.default.removeItem(at: dst)

let asset = AVURLAsset(url: src)
let sem = DispatchSemaphore(value: 0)
var track: AVAssetTrack!
var natural = CGSize.zero
var fps: Float = 30
Task {
    track = try! await asset.loadTracks(withMediaType: .video).first!
    let size = try! await track.load(.naturalSize)
    let t = try! await track.load(.preferredTransform)
    let r = CGRect(origin: .zero, size: size).applying(t)
    natural = CGSize(width: abs(r.width), height: abs(r.height))
    fps = try! await track.load(.nominalFrameRate)
    sem.signal()
}
sem.wait()

// Even dimensions, aspect kept.
let w = width - width % 2
var h = Int((Double(w) * natural.height / natural.width).rounded())
h -= h % 2

let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
])
output.alwaysCopiesSampleData = false
reader.add(output)

let writer = try AVAssetWriter(outputURL: dst, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: w,
    AVVideoHeightKey: h,
    AVVideoScalingModeKey: AVVideoScalingModeResizeAspectFill,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: kbps * 1000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalKey: Int(max(fps, 24)) * 2,
        AVVideoExpectedSourceFrameRateKey: Int(max(fps, 24)),
    ],
])
input.expectsMediaDataInRealTime = false
writer.add(input)

reader.startReading()
writer.startWriting()
var started = false
while let sample = output.copyNextSampleBuffer() {
    if !started {
        writer.startSession(atSourceTime: CMSampleBufferGetPresentationTimeStamp(sample))
        started = true
    }
    while !input.isReadyForMoreMediaData { usleep(2000) }
    input.append(sample)
}
input.markAsFinished()
writer.finishWriting { sem.signal() }
sem.wait()
if writer.status != .completed { print("FAILED:", writer.error as Any); exit(2) }

// Poster frame.
let gen = AVAssetImageGenerator(asset: asset)
gen.appliesPreferredTrackTransform = true
gen.maximumSize = CGSize(width: w, height: h)
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
Task {
    let (image, _) = try! await gen.image(at: CMTime(seconds: posterAt, preferredTimescale: 600))
    let dest = CGImageDestinationCreateWithURL(posterURL as CFURL, UTType.jpeg.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: 0.86] as CFDictionary)
    CGImageDestinationFinalize(dest)
    sem.signal()
}
sem.wait()
let bytes = (try? FileManager.default.attributesOfItem(atPath: dst.path)[.size] as? Int) ?? 0
print("\(dst.lastPathComponent): \(w)x\(h), \(bytes / 1024) KB")
