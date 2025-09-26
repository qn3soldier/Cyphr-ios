# Manual Instructions to Add BIP39 to Xcode

## Steps to add bip39-english.txt to the Xcode project:

1. **Open Xcode**:
   ```bash
   open CyphrNative.xcodeproj
   ```

2. **Add File to Project**:
   - Right-click on the project navigator (left panel)
   - Select "Add Files to 'CyphrNative'..."
   - Navigate to the `Resources` folder
   - Select `bip39-english.txt`
   - Make sure "Copy items if needed" is UNCHECKED (file is already in the project directory)
   - Make sure "Add to targets: CyphrNative" is CHECKED
   - Click "Add"

3. **Verify in Build Phases**:
   - Select the CyphrNative target
   - Go to "Build Phases" tab
   - Expand "Copy Bundle Resources"
   - Verify that `bip39-english.txt` appears in the list

4. **Clean and Build**:
   - Product → Clean Build Folder (⇧⌘K)
   - Product → Build (⌘B)

## Alternative: Create a Resources group

If the Resources folder doesn't exist in Xcode:

1. Right-click on the project
2. Select "New Group"
3. Name it "Resources"
4. Then add the bip39-english.txt file to this group

## Verification

After building, verify the file is in the app bundle:
```bash
find ~/Library/Developer/Xcode/DerivedData -name "*.app" -exec find {} -name "bip39-english.txt" \;
```

This should show the file inside the built app bundle.