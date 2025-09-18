/**
 * AML/KYC Compliance Service
 * Provides Anti-Money Laundering and Know Your Customer compliance
 * with selective disclosure and privacy protection
 */

import { supabase } from "../supabaseClient";
import { secureStorage } from '../crypto/secureStorage';
import QuantumCryptoSecure from '../crypto/quantumCryptoSecure';

export interface KYCData {
  userId: string;
  level: 'basic' | 'intermediate' | 'advanced';
  personalInfo: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    nationality?: string;
    address?: string;
  };
  documents: {
    idDocument?: string;
    proofOfAddress?: string;
    selfie?: string;
  };
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedAt?: string;
  limits: {
    dailyLimit: number;
    monthlyLimit: number;
    yearlyLimit: number;
  };
}

export interface TransactionRisk {
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  requiresReview: boolean;
  blockedReason?: string;
}

export interface ComplianceReport {
  userId: string;
  reportId: string;
  period: { start: string; end: string };
  transactions: {
    total: number;
    volume: number;
    flagged: number;
    blocked: number;
  };
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high';
    factors: string[];
  };
  generatedAt: string;
}

export class AMLKYCService {
  private readonly KYC_LEVELS = {
    basic: { dailyLimit: 1000, monthlyLimit: 5000, yearlyLimit: 50000 },
    intermediate: { dailyLimit: 5000, monthlyLimit: 25000, yearlyLimit: 250000 },
    advanced: { dailyLimit: 50000, monthlyLimit: 250000, yearlyLimit: 2500000 }
  };

  private readonly RISK_THRESHOLDS = {
    high_amount: 10000,
    suspicious_pattern: 5,
    rapid_transactions: 10,
    sanctioned_countries: ['XX', 'YY'], // Placeholder
    high_risk_addresses: new Set<string>()
  };

  constructor() {
    console.log('🛡️ AML/KYC Compliance Service initialized');
  }

  /**
   * Initialize KYC for user
   */
  async initializeKYC(userId: string, level: 'basic' | 'intermediate' | 'advanced' = 'basic'): Promise<KYCData> {
    try {
      const kycData: KYCData = {
        userId,
        level,
        personalInfo: {},
        documents: {},
        verificationStatus: 'pending',
        limits: this.KYC_LEVELS[level]
      };

      // Store encrypted KYC data
      await this.storeKYCData(kycData);

      console.log(`✅ KYC initialized for user ${userId} at ${level} level`);
      return kycData;

    } catch (error) {
      console.error('❌ Error initializing KYC:', error);
      throw new Error(`KYC initialization failed: ${error.message}`);
    }
  }

  /**
   * Update KYC information with selective disclosure
   */
  async updateKYCInfo(
    userId: string,
    updates: Partial<KYCData['personalInfo']>,
    documents?: Partial<KYCData['documents']>
  ): Promise<boolean> {
    try {
      const existingKYC = await this.getKYCData(userId);
      if (!existingKYC) {
        throw new Error('KYC record not found');
      }

      // Update personal info with selective disclosure
      const updatedKYC: KYCData = {
        ...existingKYC,
        personalInfo: { ...existingKYC.personalInfo, ...updates },
        documents: documents ? { ...existingKYC.documents, ...documents } : existingKYC.documents
      };

      // Recalculate verification status
      updatedKYC.verificationStatus = this.calculateVerificationStatus(updatedKYC);

      await this.storeKYCData(updatedKYC);

      console.log(`✅ KYC updated for user ${userId}`);
      return true;

    } catch (error) {
      console.error('❌ Error updating KYC:', error);
      throw new Error(`KYC update failed: ${error.message}`);
    }
  }

  /**
   * Assess transaction risk
   */
  async assessTransactionRisk(
    userId: string,
    amount: number,
    recipientAddress: string,
    asset: string = 'XLM'
  ): Promise<TransactionRisk> {
    try {
      const kycData = await this.getKYCData(userId);
      const userHistory = await this.getUserTransactionHistory(userId);
      
      let riskScore = 0;
      const flags: string[] = [];

      // Amount-based risk
      if (amount > this.RISK_THRESHOLDS.high_amount) {
        riskScore += 30;
        flags.push('HIGH_AMOUNT');
      }

      // Velocity risk
      const recentTransactions = userHistory.filter(tx => 
        Date.now() - new Date(tx.created_at).getTime() < 24 * 60 * 60 * 1000
      );
      
      if (recentTransactions.length > this.RISK_THRESHOLDS.rapid_transactions) {
        riskScore += 25;
        flags.push('RAPID_TRANSACTIONS');
      }

      // Pattern analysis
      const suspiciousPatterns = this.detectSuspiciousPatterns(userHistory, amount, recipientAddress);
      if (suspiciousPatterns.length > 0) {
        riskScore += 20;
        flags.push(...suspiciousPatterns);
      }

      // KYC level risk adjustment
      if (!kycData || kycData.verificationStatus !== 'verified') {
        riskScore += 15;
        flags.push('UNVERIFIED_USER');
      }

      // Recipient risk
      if (this.RISK_THRESHOLDS.high_risk_addresses.has(recipientAddress)) {
        riskScore += 35;
        flags.push('HIGH_RISK_RECIPIENT');
      }

      // Compliance limits check
      const limitsExceeded = await this.checkComplianceLimits(userId, amount);
      if (limitsExceeded.exceeded) {
        riskScore += 40;
        flags.push('LIMITS_EXCEEDED');
      }

      // Calculate final risk level
      let riskLevel: TransactionRisk['riskLevel'];
      if (riskScore >= 80) riskLevel = 'critical';
      else if (riskScore >= 60) riskLevel = 'high';
      else if (riskScore >= 30) riskLevel = 'medium';
      else riskLevel = 'low';

      const risk: TransactionRisk = {
        riskScore: Math.min(riskScore, 100),
        riskLevel,
        flags,
        requiresReview: riskScore >= 60,
        blockedReason: riskScore >= 80 ? 'High risk transaction requires manual review' : undefined
      };

      // Log risk assessment
      await this.logRiskAssessment(userId, amount, recipientAddress, risk);

      console.log(`🔍 Risk assessment for ${userId}: ${riskLevel} (${riskScore}/100)`);
      return risk;

    } catch (error) {
      console.error('❌ Error assessing transaction risk:', error);
      // Return safe default
      return {
        riskScore: 100,
        riskLevel: 'critical',
        flags: ['ASSESSMENT_ERROR'],
        requiresReview: true,
        blockedReason: 'Risk assessment failed'
      };
    }
  }

  /**
   * Check compliance limits
   */
  private async checkComplianceLimits(userId: string, amount: number): Promise<{
    exceeded: boolean;
    limitType?: string;
    currentUsage?: number;
    limit?: number;
  }> {
    try {
      const kycData = await this.getKYCData(userId);
      if (!kycData) {
        return { exceeded: true, limitType: 'NO_KYC' };
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisYear = new Date(now.getFullYear(), 0, 1);

      // Get transaction history
      const { data: transactions } = await supabase
        .from('enhanced_transactions')
        .select('amount, created_at')
        .eq('user_id', userId)
        .gte('created_at', thisYear.toISOString());

      if (transactions) {
        // Daily limit check
        const dailyTransactions = transactions.filter(tx => 
          new Date(tx.created_at) >= today
        );
        const dailyUsage = dailyTransactions.reduce((sum, tx) => sum + tx.amount, 0);
        
        if (dailyUsage + amount > kycData.limits.dailyLimit) {
          return {
            exceeded: true,
            limitType: 'DAILY',
            currentUsage: dailyUsage,
            limit: kycData.limits.dailyLimit
          };
        }

        // Monthly limit check
        const monthlyTransactions = transactions.filter(tx => 
          new Date(tx.created_at) >= thisMonth
        );
        const monthlyUsage = monthlyTransactions.reduce((sum, tx) => sum + tx.amount, 0);
        
        if (monthlyUsage + amount > kycData.limits.monthlyLimit) {
          return {
            exceeded: true,
            limitType: 'MONTHLY',
            currentUsage: monthlyUsage,
            limit: kycData.limits.monthlyLimit
          };
        }

        // Yearly limit check
        const yearlyUsage = transactions.reduce((sum, tx) => sum + tx.amount, 0);
        
        if (yearlyUsage + amount > kycData.limits.yearlyLimit) {
          return {
            exceeded: true,
            limitType: 'YEARLY',
            currentUsage: yearlyUsage,
            limit: kycData.limits.yearlyLimit
          };
        }
      }

      return { exceeded: false };

    } catch (error) {
      console.error('❌ Error checking compliance limits:', error);
      return { exceeded: true, limitType: 'CHECK_ERROR' };
    }
  }

  /**
   * Detect suspicious transaction patterns
   */
  private detectSuspiciousPatterns(
    history: any[],
    currentAmount: number,
    recipientAddress: string
  ): string[] {
    const patterns: string[] = [];

    // Structuring detection (multiple transactions just under reporting threshold)
    const recentLargeTransactions = history.filter(tx => 
      tx.amount > 9000 && 
      Date.now() - new Date(tx.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
    );
    
    if (recentLargeTransactions.length >= 3 && currentAmount > 9000) {
      patterns.push('POTENTIAL_STRUCTURING');
    }

    // Round number transactions (possible layering)
    if (currentAmount % 1000 === 0 && currentAmount >= 5000) {
      patterns.push('ROUND_AMOUNT');
    }

    // Frequent transactions to same address
    const sameRecipientTxs = history.filter(tx => 
      tx.to_address === recipientAddress &&
      Date.now() - new Date(tx.created_at).getTime() < 24 * 60 * 60 * 1000
    );
    
    if (sameRecipientTxs.length >= 5) {
      patterns.push('FREQUENT_SAME_RECIPIENT');
    }

    // Rapid back-and-forth transactions
    const recipientToUserTxs = history.filter(tx => 
      tx.from_address === recipientAddress &&
      Date.now() - new Date(tx.created_at).getTime() < 60 * 60 * 1000 // Within 1 hour
    );
    
    if (recipientToUserTxs.length > 0) {
      patterns.push('RAPID_BACK_AND_FORTH');
    }

    return patterns;
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<ComplianceReport> {
    try {
      const reportId = `report_${userId}_${Date.now()}`;

      // Get transaction data for period
      const { data: transactions } = await supabase
        .from('enhanced_transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Get risk assessments for period
      const { data: riskAssessments } = await supabase
        .from('risk_assessments')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const totalTransactions = transactions?.length || 0;
      const totalVolume = transactions?.reduce((sum, tx) => sum + tx.amount, 0) || 0;
      const flaggedTransactions = riskAssessments?.filter(r => r.risk_score >= 30).length || 0;
      const blockedTransactions = riskAssessments?.filter(r => r.risk_score >= 80).length || 0;

      // Assess overall risk
      const avgRiskScore = riskAssessments?.length > 0 
        ? riskAssessments.reduce((sum, r) => sum + r.risk_score, 0) / riskAssessments.length
        : 0;

      let overallRisk: 'low' | 'medium' | 'high';
      if (avgRiskScore >= 60) overallRisk = 'high';
      else if (avgRiskScore >= 30) overallRisk = 'medium';
      else overallRisk = 'low';

      const report: ComplianceReport = {
        userId,
        reportId,
        period: { start: startDate, end: endDate },
        transactions: {
          total: totalTransactions,
          volume: totalVolume,
          flagged: flaggedTransactions,
          blocked: blockedTransactions
        },
        riskAssessment: {
          overallRisk,
          factors: this.extractRiskFactors(riskAssessments || [])
        },
        generatedAt: new Date().toISOString()
      };

      // Store report securely
      await this.storeComplianceReport(report);

      console.log(`📊 Compliance report generated: ${reportId}`);
      return report;

    } catch (error) {
      console.error('❌ Error generating compliance report:', error);
      throw new Error(`Report generation failed: ${error.message}`);
    }
  }

  /**
   * Store KYC data with encryption
   */
  private async storeKYCData(kycData: KYCData): Promise<void> {
    const encryptedData = new TextEncoder().encode(JSON.stringify(kycData));
    await secureStorage.store(`kyc_${kycData.userId}`, encryptedData, { expireMinutes: 1440 * 30 }); // 30 days

    // Store metadata in database (non-sensitive)
    await supabase
      .from('kyc_metadata')
      .upsert({
        user_id: kycData.userId,
        level: kycData.level,
        verification_status: kycData.verificationStatus,
        daily_limit: kycData.limits.dailyLimit,
        monthly_limit: kycData.limits.monthlyLimit,
        yearly_limit: kycData.limits.yearlyLimit,
        updated_at: new Date().toISOString()
      });
  }

  /**
   * Get KYC data with decryption
   */
  private async getKYCData(userId: string): Promise<KYCData | null> {
    try {
      const encryptedData = await secureStorage.retrieve(`kyc_${userId}`);
      if (!encryptedData) return null;

      const kycData: KYCData = JSON.parse(new TextDecoder().decode(encryptedData));
      return kycData;

    } catch (error) {
      console.error('❌ Error retrieving KYC data:', error);
      return null;
    }
  }

  /**
   * Calculate verification status based on provided information
   */
  private calculateVerificationStatus(kycData: KYCData): 'pending' | 'verified' | 'rejected' {
    const { personalInfo, documents, level } = kycData;

    switch (level) {
      case 'basic':
        if (personalInfo.firstName && personalInfo.lastName) {
          return 'verified';
        }
        break;
      
      case 'intermediate':
        if (personalInfo.firstName && personalInfo.lastName && 
            personalInfo.dateOfBirth && documents.idDocument) {
          return 'verified';
        }
        break;
      
      case 'advanced':
        if (personalInfo.firstName && personalInfo.lastName && 
            personalInfo.dateOfBirth && personalInfo.address &&
            documents.idDocument && documents.proofOfAddress && documents.selfie) {
          return 'verified';
        }
        break;
    }

    return 'pending';
  }

  /**
   * Get user transaction history
   */
  private async getUserTransactionHistory(userId: string): Promise<any[]> {
    const { data } = await supabase
      .from('enhanced_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    return data || [];
  }

  /**
   * Log risk assessment
   */
  private async logRiskAssessment(
    userId: string,
    amount: number,
    recipientAddress: string,
    risk: TransactionRisk
  ): Promise<void> {
    try {
      await supabase
        .from('risk_assessments')
        .insert({
          user_id: userId,
          amount,
          recipient_address: recipientAddress,
          risk_score: risk.riskScore,
          risk_level: risk.riskLevel,
          flags: risk.flags,
          requires_review: risk.requiresReview,
          blocked_reason: risk.blockedReason,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('❌ Error logging risk assessment:', error);
    }
  }

  /**
   * Store compliance report
   */
  private async storeComplianceReport(report: ComplianceReport): Promise<void> {
    const encryptedReport = new TextEncoder().encode(JSON.stringify(report));
    await secureStorage.store(`report_${report.reportId}`, encryptedReport, { expireMinutes: 1440 * 90 }); // 90 days
  }

  /**
   * Extract risk factors from assessments
   */
  private extractRiskFactors(assessments: any[]): string[] {
    const allFlags = assessments.flatMap(a => a.flags || []);
    const uniqueFlags = [...new Set(allFlags)];
    return uniqueFlags.slice(0, 10); // Top 10 risk factors
  }

  /**
   * Get compliance status for user
   */
  async getComplianceStatus(userId: string): Promise<{
    kycLevel: string;
    verificationStatus: string;
    limits: any;
    riskLevel: string;
  }> {
    try {
      const kycData = await this.getKYCData(userId);
      
      if (!kycData) {
        return {
          kycLevel: 'none',
          verificationStatus: 'unverified',
          limits: this.KYC_LEVELS.basic,
          riskLevel: 'high'
        };
      }

      return {
        kycLevel: kycData.level,
        verificationStatus: kycData.verificationStatus,
        limits: kycData.limits,
        riskLevel: kycData.verificationStatus === 'verified' ? 'low' : 'medium'
      };

    } catch (error) {
      console.error('❌ Error getting compliance status:', error);
      throw error;
    }
  }
}

export default new AMLKYCService();