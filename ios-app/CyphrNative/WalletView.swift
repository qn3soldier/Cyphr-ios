import SwiftUI
import Combine

/// Enterprise-Grade Wallet Screen - Better than Lobstr/Exodus
struct WalletView: View {
    @StateObject private var walletService = HDWalletService.shared
    @StateObject private var networkService = NetworkService.shared
    @State private var selectedTab: WalletTab = .balance
    @State private var showingSendSheet = false
    @State private var showingReceiveSheet = false
    @State private var showingSwapSheet = false
    @State private var showingAddAssetSheet = false
    @State private var refreshing = false
    
    // Wallet state
    @State private var totalBalanceUSD = "0.00"
    @State private var xlmBalance = "0"
    @State private var usdcBalance = "0"
    @State private var assets: [AssetBalance] = []
    @State private var transactions: [TransactionItem] = []
    @State private var priceData: PriceData?
    
    enum WalletTab: String, CaseIterable {
        case balance = "Balance"
        case assets = "Assets"
        case activity = "Activity"
        case defi = "DeFi"
        
        var icon: String {
            switch self {
            case .balance: return "creditcard.fill"
            case .assets: return "bitcoinsign.circle.fill"
            case .activity: return "arrow.left.arrow.right"
            case .defi: return "chart.line.uptrend.xyaxis"
            }
        }
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                // Lightning gradient background
                LinearGradient(
                    colors: [
                        Color(red: 0.05, green: 0.06, blue: 0.10),
                        Color(red: 0.07, green: 0.08, blue: 0.12)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Header
                    walletHeader
                    
                    // Tab selector
                    tabSelector
                    
                    // Content
                    ScrollView {
                        VStack(spacing: 24) {
                            switch selectedTab {
                            case .balance:
                                balanceView
                            case .assets:
                                assetsView
                            case .activity:
                                activityView
                            case .defi:
                                defiView
                            }
                        }
                        .padding()
                    }
                    .refreshable {
                        await refreshWallet()
                    }
                    
                    // Action buttons
                    actionButtons
                }
            }
            #if os(iOS)
            .navigationBarHidden(true)
            #endif
            .sheet(isPresented: $showingSendSheet) {
                SendCryptoView()
            }
            .sheet(isPresented: $showingReceiveSheet) {
                ReceiveCryptoView()
            }
            .sheet(isPresented: $showingSwapSheet) {
                SwapCryptoView()
            }
            .sheet(isPresented: $showingAddAssetSheet) {
                AddAssetView()
            }
        }
        .onAppear {
            Task {
                await loadWalletData()
            }
        }
    }
    
    // MARK: - Header
    
    private var walletHeader: some View {
        VStack(spacing: 16) {
            // Top bar
            HStack {
                Text("Wallet")
                    .font(.largeTitle.bold())
                    .foregroundColor(.white)
                
                Spacer()
                
                // Network indicator
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 8, height: 8)
                    Text("Stellar")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.7))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.white.opacity(0.1))
                .cornerRadius(20)
                
                // Settings
                Button(action: {}) {
                    Image(systemName: "gearshape.fill")
                        .font(.title3)
                        .foregroundColor(.white.opacity(0.7))
                }
            }
            
            // Total balance
            VStack(spacing: 8) {
                Text("Total Balance")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
                
                HStack(alignment: .top, spacing: 4) {
                    Text("$")
                        .font(.title2)
                        .foregroundColor(.white.opacity(0.7))
                    Text(totalBalanceUSD)
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                
                // 24h change
                HStack(spacing: 4) {
                    Image(systemName: priceData?.isPositive ?? true ? "arrow.up.right" : "arrow.down.right")
                        .font(.caption)
                    Text("\(priceData?.change24h ?? "0.00")%")
                        .font(.caption.bold())
                }
                .foregroundColor(priceData?.isPositive ?? true ? .green : .red)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    (priceData?.isPositive ?? true ? Color.green : Color.red).opacity(0.2)
                )
                .cornerRadius(12)
            }
        }
        .padding()
    }
    
    // MARK: - Tab Selector
    
    private var tabSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(WalletTab.allCases, id: \.self) { tab in
                    Button(action: { selectedTab = tab }) {
                        HStack(spacing: 6) {
                            Image(systemName: tab.icon)
                                .font(.caption)
                            Text(tab.rawValue)
                                .font(.caption.bold())
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(
                            selectedTab == tab ?
                            AnyShapeStyle(LinearGradient(
                                colors: [.purple, .blue],
                                startPoint: .leading,
                                endPoint: .trailing
                            )) :
                            AnyShapeStyle(Color.white.opacity(0.1))
                        )
                        .foregroundColor(.white)
                        .cornerRadius(20)
                    }
                }
            }
            .padding(.horizontal)
        }
        .padding(.bottom, 8)
    }
    
    // MARK: - Balance View
    
    private var balanceView: some View {
        VStack(spacing: 16) {
            // Main assets
            VStack(spacing: 12) {
                // XLM Balance
                AssetCard(
                    symbol: "XLM",
                    name: "Stellar Lumens",
                    balance: xlmBalance,
                    valueUSD: calculateUSD(amount: xlmBalance, price: priceData?.xlmPrice ?? 0),
                    icon: "star.fill",
                    gradient: [.blue, .cyan]
                )
                
                // USDC Balance
                AssetCard(
                    symbol: "USDC",
                    name: "USD Coin",
                    balance: usdcBalance,
                    valueUSD: usdcBalance,
                    icon: "dollarsign.circle.fill",
                    gradient: [.green, .mint]
                )
            }
            
            // Portfolio chart
            portfolioChart
            
            // Quick stats
            quickStats
        }
    }
    
    private var portfolioChart: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Portfolio Performance")
                .font(.headline)
                .foregroundColor(.white)
            
            // Chart placeholder
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.white.opacity(0.05))
                .frame(height: 200)
                .overlay(
                    // Mock chart
                    GeometryReader { geometry in
                        Path { path in
                            let width = geometry.size.width
                            let height = geometry.size.height
                            let points = generateMockChartPoints(width: width, height: height)
                            
                            path.move(to: points[0])
                            for point in points.dropFirst() {
                                path.addLine(to: point)
                            }
                        }
                        .stroke(
                            LinearGradient(
                                colors: [.purple, .blue],
                                startPoint: .leading,
                                endPoint: .trailing
                            ),
                            lineWidth: 2
                        )
                    }
                    .padding()
                )
        }
    }
    
    private var quickStats: some View {
        HStack(spacing: 12) {
            StatCard(
                title: "24h Volume",
                value: "$1,234",
                change: "+5.2%",
                isPositive: true
            )
            
            StatCard(
                title: "Total Sent",
                value: "$5,678",
                change: "12 txns",
                isPositive: true
            )
            
            StatCard(
                title: "Total Received",
                value: "$9,012",
                change: "8 txns",
                isPositive: true
            )
        }
    }
    
    // MARK: - Assets View
    
    private var assetsView: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Your Assets")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Spacer()
                
                Button(action: { showingAddAssetSheet = true }) {
                    Label("Add", systemImage: "plus.circle.fill")
                        .font(.caption)
                        .foregroundColor(.purple)
                }
            }
            
            if assets.isEmpty {
                emptyAssetsView
            } else {
                VStack(spacing: 0) {
                    ForEach(assets) { asset in
                        AssetRow(asset: asset)
                        
                        if asset.id != assets.last?.id {
                            Divider()
                                .background(Color.white.opacity(0.1))
                                .padding(.leading, 60)
                        }
                    }
                }
                .background(Color.white.opacity(0.05))
                .cornerRadius(12)
            }
        }
    }
    
    private var emptyAssetsView: some View {
        VStack(spacing: 16) {
            Image(systemName: "bitcoinsign.circle")
                .font(.system(size: 60))
                .foregroundColor(.white.opacity(0.3))
            
            Text("No assets yet")
                .font(.headline)
                .foregroundColor(.white.opacity(0.5))
            
            Text("Add assets to diversify your portfolio")
                .font(.caption)
                .foregroundColor(.white.opacity(0.3))
            
            Button(action: { showingAddAssetSheet = true }) {
                Text("Add Asset")
                    .font(.caption.bold())
                    .padding(.horizontal, 20)
                    .padding(.vertical, 8)
                    .background(
                        LinearGradient(
                            colors: [.purple, .blue],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .foregroundColor(.white)
                    .cornerRadius(20)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
    
    // MARK: - Activity View
    
    private var activityView: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Recent Activity")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Spacer()
                
                Menu {
                    Button("All") {}
                    Button("Sent") {}
                    Button("Received") {}
                    Button("Swapped") {}
                } label: {
                    HStack(spacing: 4) {
                        Text("Filter")
                            .font(.caption)
                        Image(systemName: "chevron.down")
                            .font(.caption2)
                    }
                    .foregroundColor(.purple)
                }
            }
            
            if transactions.isEmpty {
                emptyActivityView
            } else {
                VStack(spacing: 0) {
                    ForEach(transactions) { transaction in
                        TransactionRow(transaction: transaction)
                        
                        if transaction.id != transactions.last?.id {
                            Divider()
                                .background(Color.white.opacity(0.1))
                                .padding(.leading, 60)
                        }
                    }
                }
                .background(Color.white.opacity(0.05))
                .cornerRadius(12)
            }
        }
    }
    
    private var emptyActivityView: some View {
        VStack(spacing: 16) {
            Image(systemName: "arrow.left.arrow.right.circle")
                .font(.system(size: 60))
                .foregroundColor(.white.opacity(0.3))
            
            Text("No transactions yet")
                .font(.headline)
                .foregroundColor(.white.opacity(0.5))
            
            Text("Send or receive crypto to see activity")
                .font(.caption)
                .foregroundColor(.white.opacity(0.3))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
    
    // MARK: - DeFi View
    
    private var defiView: some View {
        VStack(spacing: 16) {
            // Yield opportunities
            VStack(alignment: .leading, spacing: 12) {
                Text("Yield Opportunities")
                    .font(.headline)
                    .foregroundColor(.white)
                
                YieldCard(
                    protocol: "Stellar AMM",
                    pair: "XLM/USDC",
                    apy: "12.5%",
                    tvl: "$2.3M",
                    risk: .medium
                )
                
                YieldCard(
                    protocol: "Ultra Stellar",
                    pair: "yUSDC",
                    apy: "8.2%",
                    tvl: "$5.7M",
                    risk: .low
                )
            }
            
            // Liquidity pools
            VStack(alignment: .leading, spacing: 12) {
                Text("Your Liquidity")
                    .font(.headline)
                    .foregroundColor(.white)
                
                Text("No liquidity positions")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
                    .background(Color.white.opacity(0.05))
                    .cornerRadius(12)
            }
        }
    }
    
    // MARK: - Action Buttons
    
    private var actionButtons: some View {
        HStack(spacing: 12) {
            ActionButton(
                title: "Send",
                icon: "arrow.up",
                gradient: [.purple, .blue],
                action: { showingSendSheet = true }
            )
            
            ActionButton(
                title: "Receive",
                icon: "arrow.down",
                gradient: [.green, .mint],
                action: { showingReceiveSheet = true }
            )
            
            ActionButton(
                title: "Swap",
                icon: "arrow.2.squarepath",
                gradient: [.orange, .yellow],
                action: { showingSwapSheet = true }
            )
            
            ActionButton(
                title: "Buy",
                icon: "plus",
                gradient: [.pink, .red],
                action: {}
            )
        }
        .padding()
        .background(
            Color.black.opacity(0.3)
                .background(.ultraThinMaterial)
        )
    }
    
    // MARK: - Helper Methods
    
    private func loadWalletData() async {
        do {
            // Load balance
            if let cyphrId = UserDefaults.standard.string(forKey: "cyphr_id") {
                let balance = try await networkService.getWalletBalance(cyphrId: cyphrId)
                xlmBalance = balance.xlm
                usdcBalance = balance.usdc
                
                // Calculate total USD
                let xlmPrice = priceData?.xlmPrice ?? 0.12
                let xlmUSD = Double(xlmBalance) ?? 0 * xlmPrice
                let usdcUSD = Double(usdcBalance) ?? 0
                totalBalanceUSD = String(format: "%.2f", xlmUSD + usdcUSD)
            }
            
            // Load transactions
            // TODO: Implement transaction loading
            
            // Load price data
            // TODO: Implement price data loading
        } catch {
            print("Failed to load wallet data: \(error)")
        }
    }
    
    private func refreshWallet() async {
        refreshing = true
        await loadWalletData()
        refreshing = false
    }
    
    private func calculateUSD(amount: String, price: Double) -> String {
        let value = (Double(amount) ?? 0) * price
        return String(format: "%.2f", value)
    }
    
    private func generateMockChartPoints(width: CGFloat, height: CGFloat) -> [CGPoint] {
        var points: [CGPoint] = []
        let steps = 20
        
        for i in 0...steps {
            let x = width * CGFloat(i) / CGFloat(steps)
            let normalizedX = CGFloat(i) / CGFloat(steps)
            let y = height * (0.5 + 0.3 * sin(normalizedX * .pi * 2) + 0.2 * sin(normalizedX * .pi * 4))
            points.append(CGPoint(x: x, y: height - y))
        }
        
        return points
    }
}

// MARK: - Component Views

struct AssetCard: View {
    let symbol: String
    let name: String
    let balance: String
    let valueUSD: String
    let icon: String
    let gradient: [Color]
    
    var body: some View {
        HStack {
            // Icon
            Circle()
                .fill(
                    LinearGradient(
                        colors: gradient,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 50, height: 50)
                .overlay(
                    Image(systemName: icon)
                        .font(.title3)
                        .foregroundColor(.white)
                )
            
            VStack(alignment: .leading, spacing: 4) {
                Text(symbol)
                    .font(.headline)
                    .foregroundColor(.white)
                Text(name)
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 4) {
                Text(balance)
                    .font(.headline)
                    .foregroundColor(.white)
                Text("$\(valueUSD)")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
            }
        }
        .padding()
        .background(Color.white.opacity(0.05))
        .cornerRadius(16)
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let change: String
    let isPositive: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption2)
                .foregroundColor(.white.opacity(0.5))
            Text(value)
                .font(.headline)
                .foregroundColor(.white)
            Text(change)
                .font(.caption2)
                .foregroundColor(isPositive ? .green : .red)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.white.opacity(0.05))
        .cornerRadius(12)
    }
}

struct AssetRow: View {
    let asset: AssetBalance
    
    var body: some View {
        HStack {
            // Icon
            Circle()
                .fill(Color.white.opacity(0.1))
                .frame(width: 40, height: 40)
                .overlay(
                    Text(asset.symbol.prefix(2))
                        .font(.caption.bold())
                        .foregroundColor(.white)
                )
            
            VStack(alignment: .leading, spacing: 2) {
                Text(asset.symbol)
                    .font(.headline)
                    .foregroundColor(.white)
                Text(asset.name)
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text(asset.balance)
                    .font(.headline)
                    .foregroundColor(.white)
                Text("$\(asset.valueUSD)")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
            }
        }
        .padding()
    }
}

struct TransactionRow: View {
    let transaction: TransactionItem
    
    var body: some View {
        HStack {
            // Icon
            Circle()
                .fill(transaction.type == .sent ? Color.red.opacity(0.2) : Color.green.opacity(0.2))
                .frame(width: 40, height: 40)
                .overlay(
                    Image(systemName: transaction.type == .sent ? "arrow.up" : "arrow.down")
                        .foregroundColor(transaction.type == .sent ? .red : .green)
                )
            
            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.type == .sent ? "Sent to" : "Received from")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
                Text(transaction.address.prefix(8) + "..." + transaction.address.suffix(4))
                    .font(.caption.monospaced())
                    .foregroundColor(.white)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(transaction.amount) \(transaction.asset)")
                    .font(.headline)
                    .foregroundColor(.white)
                Text(transaction.timeAgo)
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
            }
        }
        .padding()
    }
}

struct YieldCard: View {
    let `protocol`: String
    let pair: String
    let apy: String
    let tvl: String
    let risk: RiskLevel
    
    enum RiskLevel {
        case low, medium, high
        
        var color: Color {
            switch self {
            case .low: return .green
            case .medium: return .orange
            case .high: return .red
            }
        }
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(`protocol`)
                        .font(.headline)
                        .foregroundColor(.white)
                    Text(pair)
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.5))
                }
                
                Spacer()
                
                Text(apy)
                    .font(.title2.bold())
                    .foregroundColor(.green)
            }
            
            HStack {
                Label("TVL: \(tvl)", systemImage: "lock.fill")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.7))
                
                Spacer()
                
                HStack(spacing: 4) {
                    Circle()
                        .fill(risk.color)
                        .frame(width: 6, height: 6)
                    Text("Risk: \(String(describing: risk))")
                        .font(.caption)
                        .foregroundColor(risk.color)
                }
            }
        }
        .padding()
        .background(Color.white.opacity(0.05))
        .cornerRadius(12)
    }
}

struct ActionButton: View {
    let title: String
    let icon: String
    let gradient: [Color]
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.title3)
                Text(title)
                    .font(.caption2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(
                LinearGradient(
                    colors: gradient,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .foregroundColor(.white)
            .cornerRadius(12)
        }
    }
}

// MARK: - Models

struct AssetBalance: Identifiable {
    let id = UUID()
    let symbol: String
    let name: String
    let balance: String
    let valueUSD: String
}

struct TransactionItem: Identifiable {
    let id = UUID()
    let type: TransactionType
    let address: String
    let amount: String
    let asset: String
    let timeAgo: String
    
    enum TransactionType {
        case sent, received
    }
}

struct PriceData {
    let xlmPrice: Double
    let change24h: String
    let isPositive: Bool
}

// MARK: - Sheet Views

struct SendCryptoView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.05, green: 0.06, blue: 0.10),
                        Color(red: 0.07, green: 0.08, blue: 0.12)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                VStack {
                    Text("Send Crypto")
                        .font(.largeTitle.bold())
                        .foregroundColor(.white)
                }
            }
            #if os(iOS)
            .navigationBarItems(
                leading: Button("Cancel") { dismiss() }
                    .foregroundColor(.white),
                trailing: Button("Send") { }
                    .foregroundColor(.purple)
            )
            #endif
        }
    }
}

struct ReceiveCryptoView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.05, green: 0.06, blue: 0.10),
                        Color(red: 0.07, green: 0.08, blue: 0.12)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                VStack {
                    Text("Receive Crypto")
                        .font(.largeTitle.bold())
                        .foregroundColor(.white)
                }
            }
            #if os(iOS)
            .navigationBarItems(
                trailing: Button("Done") { dismiss() }
                    .foregroundColor(.white)
            )
            #endif
        }
    }
}

struct SwapCryptoView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.05, green: 0.06, blue: 0.10),
                        Color(red: 0.07, green: 0.08, blue: 0.12)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                VStack {
                    Text("Swap Crypto")
                        .font(.largeTitle.bold())
                        .foregroundColor(.white)
                }
            }
            #if os(iOS)
            .navigationBarItems(
                leading: Button("Cancel") { dismiss() }
                    .foregroundColor(.white),
                trailing: Button("Swap") { }
                    .foregroundColor(.purple)
            )
            #endif
        }
    }
}

struct AddAssetView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ZStack {
                LinearGradient(
                    colors: [
                        Color(red: 0.05, green: 0.06, blue: 0.10),
                        Color(red: 0.07, green: 0.08, blue: 0.12)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                VStack {
                    Text("Add Asset")
                        .font(.largeTitle.bold())
                        .foregroundColor(.white)
                }
            }
            #if os(iOS)
            .navigationBarItems(
                trailing: Button("Cancel") { dismiss() }
                    .foregroundColor(.white)
            )
            #endif
        }
    }
}

// MARK: - Preview

struct WalletView_Previews: PreviewProvider {
    static var previews: some View {
        WalletView()
    }
}