// Background removal via Vision (macOS 14+): input.jpg -> output.png (alpha)
import Foundation
import Vision
import CoreImage
import AppKit

let args = CommandLine.arguments
guard args.count == 3 else { print("usage: cutout <in> <out>"); exit(2) }
let url = URL(fileURLWithPath: args[1])
guard let ciImage = CIImage(contentsOf: url) else { print("cannot read input"); exit(1) }

let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(ciImage: ciImage)
try handler.perform([request])
guard let result = request.results?.first else { print("no foreground found"); exit(1) }
let maskPixelBuffer = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
let maskImage = CIImage(cvPixelBuffer: maskPixelBuffer)

let filter = CIFilter(name: "CIBlendWithMask")!
filter.setValue(ciImage, forKey: kCIInputImageKey)
filter.setValue(CIImage(color: .clear).cropped(to: ciImage.extent), forKey: kCIInputBackgroundImageKey)
filter.setValue(maskImage, forKey: kCIInputMaskImageKey)
let output = filter.outputImage!

let context = CIContext()
guard let cgImage = context.createCGImage(output, from: output.extent) else { print("render fail"); exit(1) }
let rep = NSBitmapImageRep(cgImage: cgImage)
let png = rep.representation(using: .png, properties: [:])!
try png.write(to: URL(fileURLWithPath: args[2]))
print("wrote \(args[2])")
