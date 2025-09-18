// S3 SERVICE FOR CYPHR MESSENGER
// Enterprise-grade S3 integration for media storage
// Date: September 7, 2025

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// S3 Bucket Names
const BUCKETS = {
  avatars: 'cyphr-avatars-prod',
  media: 'cyphr-media-prod',
  voice: 'cyphr-voice-prod',
  documents: 'cyphr-documents-prod',
  backups: 'cyphr-backups-prod'
};

// CDN URL (CloudFront or S3 direct)
const CDN_BASE_URL = process.env.CDN_URL || 'https://cdn.cyphr.app';

class S3Service {
  /**
   * Upload encrypted blob to S3
   * @param {Buffer} encryptedData - Encrypted file data
   * @param {string} type - Type of content (avatar, media, voice, document)
   * @param {string} userId - User ID for organizing files
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} S3 URL and metadata
   */
  async uploadEncryptedFile(encryptedData, type, userId, metadata = {}) {
    try {
      const fileId = uuidv4();
      const timestamp = Date.now();
      const key = `${userId}/${timestamp}_${fileId}.enc`;
      
      // Generate hash for integrity verification
      const fileHash = crypto.createHash('sha256').update(encryptedData).digest('hex');
      
      const params = {
        Bucket: BUCKETS[type] || BUCKETS.media,
        Key: key,
        Body: encryptedData,
        ServerSideEncryption: 'aws:kms', // Additional AWS encryption
        Metadata: {
          'x-cyphr-user': userId,
          'x-cyphr-encrypted': 'true',
          'x-cyphr-hash': fileHash,
          'x-cyphr-timestamp': timestamp.toString(),
          ...metadata
        },
        ContentType: 'application/octet-stream', // Binary encrypted data
        StorageClass: type === 'media' ? 'STANDARD_IA' : 'STANDARD' // Cost optimization
      };
      
      // Upload to S3
      const result = await s3.upload(params).promise();
      
      return {
        s3Url: result.Location,
        cdnUrl: `${CDN_BASE_URL}/${type}/${key}`,
        key: key,
        bucket: params.Bucket,
        hash: fileHash,
        size: encryptedData.length,
        uploadedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload to S3: ${error.message}`);
    }
  }
  
  /**
   * Generate pre-signed URL for direct upload from iOS
   * @param {string} type - Type of content
   * @param {string} userId - User ID
   * @param {number} fileSizeLimit - Max file size in bytes
   * @returns {Promise<Object>} Pre-signed POST data
   */
  async getPresignedUploadUrl(type, userId, fileSizeLimit = 100 * 1024 * 1024) {
    try {
      const fileId = uuidv4();
      const timestamp = Date.now();
      const key = `${userId}/${timestamp}_${fileId}.enc`;
      
      const params = {
        Bucket: BUCKETS[type] || BUCKETS.media,
        Fields: {
          key: key,
          'x-amz-server-side-encryption': 'aws:kms'
        },
        Expires: 3600, // 1 hour expiry
        Conditions: [
          ['content-length-range', 0, fileSizeLimit],
          {'x-amz-server-side-encryption': 'aws:kms'},
          ['starts-with', '$Content-Type', 'application/']
        ]
      };
      
      const presignedPost = await new Promise((resolve, reject) => {
        s3.createPresignedPost(params, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      
      return {
        uploadUrl: presignedPost.url,
        fields: presignedPost.fields,
        key: key,
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };
    } catch (error) {
      console.error('Pre-signed URL generation error:', error);
      throw new Error(`Failed to generate pre-signed URL: ${error.message}`);
    }
  }
  
  /**
   * Get pre-signed URL for download
   * @param {string} s3Url - S3 URL or key
   * @param {number} expirySeconds - URL expiry time
   * @returns {Promise<string>} Pre-signed download URL
   */
  async getPresignedDownloadUrl(s3Url, expirySeconds = 3600) {
    try {
      // Extract bucket and key from S3 URL
      let bucket, key;
      
      if (s3Url.startsWith('https://')) {
        const url = new URL(s3Url);
        const pathParts = url.pathname.split('/');
        bucket = url.hostname.split('.')[0];
        key = pathParts.slice(1).join('/');
      } else {
        // Assume it's just a key
        key = s3Url;
        bucket = BUCKETS.media; // Default bucket
      }
      
      const params = {
        Bucket: bucket,
        Key: key,
        Expires: expirySeconds
      };
      
      return await s3.getSignedUrlPromise('getObject', params);
    } catch (error) {
      console.error('Pre-signed download URL error:', error);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }
  
  /**
   * Upload chunked file for large files
   * @param {string} type - Type of content
   * @param {string} userId - User ID
   * @param {number} totalParts - Total number of chunks
   * @returns {Promise<Object>} Multipart upload data
   */
  async initiateMultipartUpload(type, userId, totalParts) {
    try {
      const fileId = uuidv4();
      const timestamp = Date.now();
      const key = `${userId}/${timestamp}_${fileId}.enc`;
      
      const params = {
        Bucket: BUCKETS[type] || BUCKETS.media,
        Key: key,
        ServerSideEncryption: 'aws:kms',
        Metadata: {
          'x-cyphr-user': userId,
          'x-cyphr-multipart': 'true',
          'x-cyphr-total-parts': totalParts.toString()
        }
      };
      
      const multipart = await s3.createMultipartUpload(params).promise();
      
      // Generate pre-signed URLs for each part
      const partUrls = [];
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const uploadUrl = await s3.getSignedUrlPromise('uploadPart', {
          Bucket: params.Bucket,
          Key: key,
          UploadId: multipart.UploadId,
          PartNumber: partNumber,
          Expires: 3600
        });
        partUrls.push({ partNumber, uploadUrl });
      }
      
      return {
        uploadId: multipart.UploadId,
        key: key,
        bucket: params.Bucket,
        partUrls: partUrls
      };
    } catch (error) {
      console.error('Multipart upload initiation error:', error);
      throw new Error(`Failed to initiate multipart upload: ${error.message}`);
    }
  }
  
  /**
   * Complete multipart upload
   * @param {string} bucket - S3 bucket
   * @param {string} key - S3 key
   * @param {string} uploadId - Multipart upload ID
   * @param {Array} parts - Array of {ETag, PartNumber}
   * @returns {Promise<Object>} Completed upload data
   */
  async completeMultipartUpload(bucket, key, uploadId, parts) {
    try {
      const params = {
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber)
        }
      };
      
      const result = await s3.completeMultipartUpload(params).promise();
      
      return {
        s3Url: result.Location,
        cdnUrl: `${CDN_BASE_URL}/${bucket}/${key}`,
        key: key,
        bucket: bucket
      };
    } catch (error) {
      console.error('Multipart upload completion error:', error);
      throw new Error(`Failed to complete multipart upload: ${error.message}`);
    }
  }
  
  /**
   * Delete file from S3
   * @param {string} s3Url - S3 URL or key
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(s3Url) {
    try {
      // Extract bucket and key
      let bucket, key;
      
      if (s3Url.startsWith('https://')) {
        const url = new URL(s3Url);
        bucket = url.hostname.split('.')[0];
        key = url.pathname.slice(1);
      } else {
        key = s3Url;
        bucket = BUCKETS.media;
      }
      
      const params = {
        Bucket: bucket,
        Key: key
      };
      
      await s3.deleteObject(params).promise();
      return true;
    } catch (error) {
      console.error('S3 delete error:', error);
      return false;
    }
  }
  
  /**
   * Batch delete expired files
   * @param {Array} s3Urls - Array of S3 URLs to delete
   * @returns {Promise<Object>} Deletion results
   */
  async batchDeleteExpiredFiles(s3Urls) {
    try {
      if (!s3Urls || s3Urls.length === 0) {
        return { deleted: 0, failed: 0 };
      }
      
      // Group by bucket
      const bucketGroups = {};
      s3Urls.forEach(url => {
        const urlObj = new URL(url);
        const bucket = urlObj.hostname.split('.')[0];
        const key = urlObj.pathname.slice(1);
        
        if (!bucketGroups[bucket]) {
          bucketGroups[bucket] = [];
        }
        bucketGroups[bucket].push({ Key: key });
      });
      
      let deleted = 0;
      let failed = 0;
      
      // Delete from each bucket
      for (const [bucket, objects] of Object.entries(bucketGroups)) {
        const params = {
          Bucket: bucket,
          Delete: {
            Objects: objects,
            Quiet: true
          }
        };
        
        const result = await s3.deleteObjects(params).promise();
        deleted += result.Deleted ? result.Deleted.length : 0;
        failed += result.Errors ? result.Errors.length : 0;
      }
      
      return { deleted, failed };
    } catch (error) {
      console.error('Batch delete error:', error);
      throw new Error(`Failed to batch delete: ${error.message}`);
    }
  }
  
  /**
   * Get file metadata
   * @param {string} s3Url - S3 URL
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(s3Url) {
    try {
      const url = new URL(s3Url);
      const bucket = url.hostname.split('.')[0];
      const key = url.pathname.slice(1);
      
      const params = {
        Bucket: bucket,
        Key: key
      };
      
      const metadata = await s3.headObject(params).promise();
      
      return {
        size: metadata.ContentLength,
        contentType: metadata.ContentType,
        lastModified: metadata.LastModified,
        encryption: metadata.ServerSideEncryption,
        metadata: metadata.Metadata,
        etag: metadata.ETag
      };
    } catch (error) {
      console.error('Get metadata error:', error);
      throw new Error(`Failed to get metadata: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new S3Service();