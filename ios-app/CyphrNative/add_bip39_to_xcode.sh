#!/bin/bash
# Script to add BIP39 word list to Xcode project

echo "🔧 Adding BIP39 word list to Xcode project..."

# First, let's create a proper reference UUID
BIP39_UUID="A1B2C3D4E5F6789012345678"
BIP39_BUILD_UUID="F1E2D3C4B5A6789012345678"

# Path to project.pbxproj
PBXPROJ="CyphrNative.xcodeproj/project.pbxproj"

# Check if file exists
if [ ! -f "Resources/bip39-english.txt" ]; then
    echo "❌ Error: Resources/bip39-english.txt not found!"
    exit 1
fi

# Backup the project file
cp "$PBXPROJ" "$PBXPROJ.backup"
echo "✅ Created backup: $PBXPROJ.backup"

# Add file reference after the last FileReference
sed -i '' "/TEMP_FE73E6BF-C6E2-4626-B0FF-F6857CE43F0C.*S3Service.swift.*sourceTree/a\\
\\		$BIP39_UUID /* bip39-english.txt */ = {isa = PBXFileReference; lastKnownFileType = text; path = \"Resources/bip39-english.txt\"; sourceTree = \"<group>\"; };" "$PBXPROJ"

echo "✅ Added file reference"

# Add to build files section
sed -i '' "/FC0D18FC9D58A698E055AB11.*MessagingService.swift in Sources/a\\
\\		$BIP39_BUILD_UUID /* bip39-english.txt in Resources */ = {isa = PBXBuildFile; fileRef = $BIP39_UUID /* bip39-english.txt */; };" "$PBXPROJ"

echo "✅ Added to build files"

# Add to Resources build phase
sed -i '' "/D6E23F137A7FFF5324340DCB.*LaunchScreen.storyboard in Resources/a\\
\\				$BIP39_BUILD_UUID /* bip39-english.txt in Resources */," "$PBXPROJ"

echo "✅ Added to Resources build phase"

# Add to main group
sed -i '' "/77D1D564D4075C714754C559.*Assets.xcassets/a\\
\\				$BIP39_UUID /* bip39-english.txt */," "$PBXPROJ"

echo "✅ Added to main group"

echo "🎉 BIP39 word list successfully added to Xcode project!"
echo ""
echo "⚠️  IMPORTANT: Please open Xcode and verify:"
echo "1. Resources/bip39-english.txt appears in the file navigator"
echo "2. The file is included in 'Copy Bundle Resources' build phase"
echo "3. Clean and rebuild the project"