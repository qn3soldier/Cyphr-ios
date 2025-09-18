// DEVICE REGISTRATION ENDPOINT - Anti-abuse protection
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fkhwhplufjzlicccgbrf.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Check device registration endpoint
async function checkDeviceRegistration(req, res) {
  try {
    const { deviceFingerprint } = req.body;
    
    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'Device fingerprint required' });
    }
    
    console.log('🔍 Checking device registration for fingerprint:', deviceFingerprint.substring(0, 16) + '...');
    
    // Check if device is already registered
    const { data: existingDevice, error } = await supabase
      .from('device_registrations')
      .select('cyphr_id, browser_info, registered_at')
      .eq('device_fingerprint', deviceFingerprint)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found, which is OK
      console.error('❌ Database error checking device:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (existingDevice) {
      console.log('⚠️ Device already registered:', existingDevice.cyphr_id);
      return res.json({
        exists: true,
        registeredBrowser: existingDevice.browser_info,
        cyphrId: existingDevice.cyphr_id,
        registeredAt: existingDevice.registered_at
      });
    }
    
    console.log('✅ Device not registered - available for new account');
    return res.json({ exists: false });
    
  } catch (error) {
    console.error('❌ Device registration check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Register device endpoint  
async function registerDevice(req, res) {
  try {
    const { deviceFingerprint, cyphrId, browserInfo } = req.body;
    
    if (!deviceFingerprint || !cyphrId) {
      return res.status(400).json({ error: 'Device fingerprint and Cyphr ID required' });
    }
    
    console.log('📱 Registering device for Cyphr ID:', cyphrId);
    
    // Insert device registration
    const { data, error } = await supabase
      .from('device_registrations')
      .insert([{
        device_fingerprint: deviceFingerprint,
        cyphr_id: cyphrId,
        browser_info: browserInfo || 'Unknown browser'
      }])
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        console.log('⚠️ Device already registered');
        return res.status(409).json({ error: 'Device already registered' });
      }
      throw error;
    }
    
    console.log('✅ Device registered successfully');
    res.json({ success: true, registered: data });
    
  } catch (error) {
    console.error('❌ Device registration error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
}

module.exports = { checkDeviceRegistration, registerDevice };
