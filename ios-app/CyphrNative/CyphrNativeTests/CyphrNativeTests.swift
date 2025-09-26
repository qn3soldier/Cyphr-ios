import XCTest
@testable import Cyphr

final class CyphrNativeTests: XCTestCase {
    func testBIP39WordListLoads() {
        XCTAssertFalse(BIP39WordList.englishWords.isEmpty, "Expected bundled BIP39 word list to be available")
    }

    func testMessageDeliveryStateAndSender() {
        let defaults = UserDefaults.standard
        let previousId = defaults.string(forKey: "cyphr_id")
        defaults.set("alice", forKey: "cyphr_id")

        let encrypted = EncryptedMessage(
            ciphertext: "ZmFrZQ==",
            nonce: "bm9uY2U=",
            tag: "dGFn"
        )

        let message = Message(
            id: "msg-1",
            chatId: "chat-1",
            senderId: "alice",
            kyberCiphertext: nil,
            encryptedContent: encrypted,
            timestamp: Date(),
            decryptedContent: "Hello",
            deliveryState: .sending
        )

        XCTAssertTrue(message.isSentByCurrentUser)
        XCTAssertEqual(message.deliveryState, .sending)

        if let previousId {
            defaults.set(previousId, forKey: "cyphr_id")
        } else {
            defaults.removeObject(forKey: "cyphr_id")
        }
    }
}
