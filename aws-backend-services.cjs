// AWS BACKEND SERVICES - замена Twilio + внешних сервисов
const AWS = require('aws-sdk');

// Configure AWS SDK
AWS.config.update({ region: 'us-east-1' });
const ses = new AWS.SES();
const sns = new AWS.SNS();

// AWS SES EMAIL SENDING (замена Twilio email)
async function sendEmailViaSES(req, res) {
  try {
    const { to, subject, html, text } = req.body;
    
    if (!to || !subject) {
      return res.status(400).json({ error: 'Email and subject required' });
    }
    
    console.log('📧 Sending email via AWS SES to:', to);
    
    const params = {
      Source: 'noreply@cyphrmessenger.app',
      Destination: {
        ToAddresses: [to]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: html || text,
            Charset: 'UTF-8'
          },
          Text: {
            Data: text || html.replace(/<[^>]*>/g, ''),
            Charset: 'UTF-8'
          }
        }
      }
    };
    
    const result = await ses.sendEmail(params).promise();
    
    console.log('✅ Email sent via SES:', result.MessageId);
    res.json({ 
      success: true, 
      messageId: result.MessageId,
      provider: 'AWS_SES'
    });
    
  } catch (error) {
    console.error('❌ AWS SES error:', error);
    res.status(500).json({ error: error.message });
  }
}

// AWS SNS SMS SENDING (замена Twilio SMS)
async function sendSMSViaSNS(req, res) {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ error: 'Phone number and message required' });
    }
    
    console.log('📱 Sending SMS via AWS SNS to:', to);
    
    const params = {
      Message: message,
      PhoneNumber: to,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: 'Cyphr'
        },
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String', 
          StringValue: 'Transactional'
        }
      }
    };
    
    const result = await sns.publish(params).promise();
    
    console.log('✅ SMS sent via SNS:', result.MessageId);
    res.json({ 
      success: true, 
      messageId: result.MessageId,
      provider: 'AWS_SNS'
    });
    
  } catch (error) {
    console.error('❌ AWS SNS error:', error);
    res.status(500).json({ error: error.message });
  }
}

// AWS S3 FILE UPLOAD (замена Supabase storage)
async function uploadToS3(req, res) {
  try {
    const { bucket, fileName } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'File required' });
    }
    
    console.log('📁 Uploading file to S3:', fileName);
    
    const s3 = new AWS.S3();
    const params = {
      Bucket: bucket || 'cyphr-storage',
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read'
    };
    
    const result = await s3.upload(params).promise();
    
    console.log('✅ File uploaded to S3:', result.Location);
    res.json({
      success: true,
      url: result.Location,
      provider: 'AWS_S3'
    });
    
  } catch (error) {
    console.error('❌ S3 upload error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  sendEmailViaSES,
  sendSMSViaSNS,
  uploadToS3
};