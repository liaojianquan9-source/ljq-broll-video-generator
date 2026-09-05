import AppKit
import CoreText
import Foundation

// Draw only publication labels. No source or replica image is opened here.
// Usage: swift render-labels.swift OUTPUT_DIRECTORY [FONT_POSTSCRIPT_NAME]
let args = CommandLine.arguments
guard args.count == 2 || args.count == 3 else {
    fatalError("Usage: swift render-labels.swift OUTPUT_DIRECTORY [FONT_POSTSCRIPT_NAME]")
}
let output = URL(fileURLWithPath: args[1], isDirectory: true)
let fontName = args.count == 3 ? args[2] : "PingFangSC-Semibold"
guard let font = NSFont(name: fontName, size: 40) else {
    fatalError("Font unavailable: \(fontName). Supply a Chinese-capable font PostScript name.")
}
let labels = [
    ("label-source.png", "原视频效果"),
    ("label-replica.png", "生成的复刻效果"),
    ("label-model.png", "GPT-6 Astra + Remotion")
]
let ctFont = CTFontCreateWithName(font.fontName as CFString, 40, nil)
for (_, text) in labels {
    let characters = Array(text.utf16)
    var glyphs = [CGGlyph](repeating: 0, count: characters.count)
    guard CTFontGetGlyphsForCharacters(ctFont, characters, &glyphs, characters.count) else {
        fatalError("Font lacks a required label glyph: \(font.fontName)")
    }
}
for (filename, text) in labels {
    let path = output.appendingPathComponent(filename)
    guard !FileManager.default.fileExists(atPath: path.path) else {
        fatalError("Refusing to overwrite \(filename)")
    }
    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: 1280, pixelsHigh: 80,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
        isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    ), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
        fatalError("Cannot allocate label bitmap")
    }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    NSColor(srgbRed: 0.045, green: 0.071, blue: 0.125, alpha: 1).setFill()
    NSRect(x: 0, y: 0, width: 1280, height: 80).fill()
    let string = NSAttributedString(string: text, attributes: [
        .font: font,
        .foregroundColor: NSColor.white
    ])
    let size = string.size()
    string.draw(at: NSPoint(x: (1280 - size.width) / 2, y: (80 - size.height) / 2))
    NSGraphicsContext.restoreGraphicsState()
    guard let png = bitmap.representation(using: .png, properties: [:]) else {
        fatalError("Cannot encode label")
    }
    try png.write(to: path, options: .withoutOverwriting)
}
print("Chinese glyph check passed; label font: \(font.fontName)")
