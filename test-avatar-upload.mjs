#!/usr/bin/env node

/**
 * Test Avatar Upload Fix
 * Tests avatar upload to ensure RLS policies work correctly
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🧪 Testing avatar upload functionality...\n');

try {
  // Test 1: Check if avatars bucket exists and is accessible
  console.log('📁 Testing bucket access...');
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  
  if (bucketsError) {
    console.error('❌ Failed to list buckets:', bucketsError);
  } else {
    const avatarsBucket = buckets.find(b => b.name === 'avatars');
    console.log(`✅ Avatars bucket exists: ${!!avatarsBucket}`);
    console.log(`✅ Avatars bucket public: ${avatarsBucket?.public}`);
  }
  
  // Test 2: Try to list files in avatars bucket
  console.log('\n📋 Testing file listing...');
  const { data: files, error: listError } = await supabase.storage
    .from('avatars')
    .list('', { limit: 5 });
    
  if (listError) {
    console.error('❌ Failed to list files:', listError);
  } else {
    console.log(`✅ Can list files in avatars bucket: ${files.length} files found`);
  }
  
  // Test 3: Try to upload a test file
  console.log('\n📤 Testing file upload...');
  
  // Create a small test image (1x1 pixel PNG)
  const testImageData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  const testFileName = `test-avatar-${Date.now()}.png`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(testFileName, testImageData, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: true
    });
    
  if (uploadError) {
    console.error('❌ Upload failed:', uploadError);
    console.error('Error details:', JSON.stringify(uploadError, null, 2));
    
    // Check if it's an RLS policy issue
    if (uploadError.message?.includes('policy') || uploadError.message?.includes('RLS')) {
      console.log('\n🔍 This appears to be an RLS policy issue');
      console.log('💡 Anonymous users might not have upload permissions');
    }
  } else {
    console.log('✅ Upload successful:', uploadData.path);
    
    // Test 4: Try to get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(testFileName);
      
    console.log('✅ Public URL generated:', urlData.publicUrl);
    
    // Test 5: Clean up - delete test file
    const { error: deleteError } = await supabase.storage
      .from('avatars')
      .remove([testFileName]);
      
    if (deleteError) {
      console.log('⚠️ Failed to clean up test file:', deleteError);
    } else {
      console.log('✅ Test file cleaned up');
    }
  }
  
} catch (error) {
  console.error('❌ Unexpected error:', error);
}

console.log('\n🧪 Avatar upload test completed');