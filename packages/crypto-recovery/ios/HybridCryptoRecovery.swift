//
// HybridCryptoRecovery.swift
// The iOS half: each backup a generic-password item in the Keychain, synchronizable, so iCloud Keychain carries it
// end to end encrypted to every device on the Apple Account. The bytes are a sealed backup, opaque here.
//

import Foundation
import NitroModules
import Security

final class HybridCryptoRecovery: HybridCryptoRecoverySpec {
  /// The items' service: this module's, apart from whatever else the app keeps in its Keychain.
  private static let service = "com.hzblj.crypto-recovery"

  var store: RecoveryStore { .icloudKeychain }

  func reach() throws -> Promise<Reach> {
    // Whether iCloud Keychain is on is not the app's to ask: a synchronizable item syncs when it is.
    Promise.resolved(withResult: .icloudKeychain)
  }

  func save(id: String, backup: ArrayBuffer) throws -> Promise<Void> {
    // Copied while the call still owns the JS buffer.
    let data = backup.toData(copyIfNeeded: true)
    return Promise.async {
      let item = Self.item(id)
      var status = SecItemUpdate(item as CFDictionary, [kSecValueData as String: data] as CFDictionary)
      if status == errSecItemNotFound {
        var added = item
        added[kSecValueData as String] = data
        // Synchronizable items cannot be this-device-only; after the first unlock, so a restore runs in the background
        // too.
        added[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        status = SecItemAdd(added as CFDictionary, nil)
      }
      try Self.check(status)
    }
  }

  func load(id: String) throws -> Promise<ArrayBuffer?> {
    Promise.async {
      var query = Self.item(id)
      query[kSecReturnData as String] = true
      query[kSecMatchLimit as String] = kSecMatchLimitOne
      var result: CFTypeRef?
      let status = SecItemCopyMatching(query as CFDictionary, &result)
      if status == errSecItemNotFound {
        return nil
      }
      try Self.check(status)
      guard let data = result as? Data else {
        throw RuntimeError.error(withMessage: "CR_ERR_FAILED")
      }
      return try ArrayBuffer.copy(data: data)
    }
  }

  func list() throws -> Promise<[String]> {
    Promise.async {
      var query = Self.items()
      query[kSecReturnAttributes as String] = true
      query[kSecMatchLimit as String] = kSecMatchLimitAll
      var result: CFTypeRef?
      let status = SecItemCopyMatching(query as CFDictionary, &result)
      if status == errSecItemNotFound {
        return []
      }
      try Self.check(status)
      let items = result as? [[String: Any]] ?? []
      return items.compactMap { $0[kSecAttrAccount as String] as? String }.sorted()
    }
  }

  func remove(id: String) throws -> Promise<Void> {
    Promise.async {
      let status = SecItemDelete(Self.item(id) as CFDictionary)
      if status != errSecItemNotFound {
        try Self.check(status)
      }
    }
  }

  /// Every backup item of this module: synchronizable ones only, which is what a query must say to see them.
  private static func items() -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrSynchronizable as String: true,
    ]
  }

  private static func item(_ id: String) -> [String: Any] {
    var item = items()
    item[kSecAttrAccount as String] = id
    return item
  }

  /// Throws the status's name: the facade maps it to an error code, and nothing else goes into the message.
  private static func check(_ status: OSStatus) throws {
    switch status {
    case errSecSuccess:
      return
    case errSecInteractionNotAllowed, errSecNotAvailable, errSecMissingEntitlement:
      // Locked since it started, no Keychain, or an app without the entitlement synchronizable items need.
      throw RuntimeError.error(withMessage: "CR_ERR_UNAVAILABLE")
    default:
      throw RuntimeError.error(withMessage: "CR_ERR_FAILED")
    }
  }
}
