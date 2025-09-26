#!/bin/bash

# This script adds missing Swift files to Xcode project using xcodebuild
echo "Adding missing files to Xcode project..."

# Files to add
FILES=(
    "LoadingOverlay.swift"
    "RecoveryPhraseView.swift"
    "SecuritySetupView.swift"
    "UsernameValidator.swift"
)

echo "Files to add:"
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file exists"
    else
        echo "  ✗ $file NOT FOUND"
    fi
done

echo ""
echo "IMPORTANT: Please open Xcode and manually add these files:"
echo "1. Open CyphrNative.xcodeproj in Xcode"
echo "2. Right-click on the CyphrNative folder in the navigator"
echo "3. Select 'Add Files to CyphrNative...'"
echo "4. Select the missing Swift files listed above"
echo "5. Make sure 'Copy items if needed' is UNCHECKED"
echo "6. Make sure 'Add to targets: CyphrNative' is CHECKED"
echo "7. Click 'Add'"
