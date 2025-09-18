// Check Cyphr ID authentication status
app.post('/api/auth/check-cyphr-id-status', async (req, res) => {
    try {
        const { cyphrId } = req.body;
        
        if (!cyphrId) {
            return res.status(400).json({
                success: false,
                error: 'Cyphr ID is required'
            });
        }

        // Remove @ prefix if provided
        const cleanCyphrId = cyphrId.startsWith('@') ? cyphrId.slice(1) : cyphrId;

        // Find user by Cyphr ID
        const userResult = await dbQuery('users', 'select', {}, { cyphr_id: cleanCyphrId });
        
        if (!userResult.data || userResult.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No account found with this Cyphr ID'
            });
        }

        const user = userResult.data[0];

        // Check authentication status
        const hasPin = !!(user.pin_hash);
        const hasBiometry = !!(user.biometric_enabled);

        res.json({
            success: true,
            cyphrId: cleanCyphrId,
            userId: user.id,
            hasPin,
            hasBiometry,
            userInfo: {
                fullName: user.full_name,
                avatarUrl: user.avatar_url
            }
        });

    } catch (error) {
        console.error('❌ Check Cyphr ID status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check Cyphr ID status'
        });
    }
});