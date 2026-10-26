package com.margelo.nitro.cryptorecovery

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.google.android.gms.auth.blockstore.Blockstore
import com.google.android.gms.auth.blockstore.BlockstoreClient
import com.google.android.gms.auth.blockstore.BlockstoreStatusCodes
import com.google.android.gms.auth.blockstore.DeleteBytesRequest
import com.google.android.gms.auth.blockstore.RetrieveBytesRequest
import com.google.android.gms.auth.blockstore.StoreBytesData
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.core.Promise
import java.util.concurrent.ExecutionException

/**
 * The Android half: each backup an entry in Block Store (Google Play services), under its id. Saved for the cloud
 * where Block Store encrypts end to end, so a new phone restored from Google's backup gets it; otherwise it reaches
 * only a phone set up from this one. The bytes are a sealed backup, opaque here.
 */
@DoNotStrip
@Keep
class HybridCryptoRecovery : HybridCryptoRecoverySpec() {
  private val client: BlockstoreClient by lazy {
    val context = NitroModules.applicationContext ?: throw RecoveryException("CR_ERR_UNAVAILABLE")
    Blockstore.getClient(context)
  }

  override val store: RecoveryStore
    get() = RecoveryStore.BLOCK_STORE

  override fun reach(): Promise<Reach> = Promise.parallel {
    if (await(client.isEndToEndEncryptionAvailable())) Reach.CLOUD else Reach.DEVICE_TRANSFER
  }

  override fun save(id: String, backup: ArrayBuffer): Promise<Unit> {
    // Copied while the call still owns the JS buffer.
    val bytes = backup.toByteArray()
    return Promise.parallel {
      val data = StoreBytesData.Builder()
        .setKey(id)
        .setBytes(bytes)
        .setShouldBackupToCloud(await(client.isEndToEndEncryptionAvailable()))
        .build()
      await(client.storeBytes(data))
      Unit
    }
  }

  override fun load(id: String): Promise<ArrayBuffer?> = Promise.parallel {
    val request = RetrieveBytesRequest.Builder().setKeys(listOf(id)).build()
    await(client.retrieveBytes(request)).blockstoreDataMap[id]?.bytes?.let { ArrayBuffer.copy(it) }
  }

  override fun list(): Promise<Array<String>> = Promise.parallel {
    val request = RetrieveBytesRequest.Builder().setRetrieveAll(true).build()
    // Block Store is the app's, not this module's: an entry is a backup when it starts with the format's magic.
    await(client.retrieveBytes(request)).blockstoreDataMap
      .filterValues { it.bytes.size >= MAGIC.size && MAGIC.indices.all { index -> it.bytes[index] == MAGIC[index] } }
      .keys
      .sorted()
      .toTypedArray()
  }

  override fun remove(id: String): Promise<Unit> = Promise.parallel {
    await(client.deleteBytes(DeleteBytesRequest.Builder().setKeys(listOf(id)).build()))
    Unit
  }

  /** The task's result, on this pool thread; a Play services failure as the status name the facade maps. */
  private fun <T> await(task: Task<T>): T =
    try {
      Tasks.await(task)
    } catch (error: ExecutionException) {
      val status = (error.cause as? ApiException)?.statusCode
      throw RecoveryException(
        when (status) {
          BlockstoreStatusCodes.TOO_MANY_ENTRIES, BlockstoreStatusCodes.MAX_SIZE_EXCEEDED -> "CR_ERR_FULL"
          CommonStatusCodes.API_NOT_CONNECTED, CommonStatusCodes.SERVICE_DISABLED,
          CommonStatusCodes.SERVICE_VERSION_UPDATE_REQUIRED -> "CR_ERR_UNAVAILABLE"
          else -> "CR_ERR_FAILED"
        }
      )
    }

  /** A status name and nothing else: no input reaches a log through it. */
  class RecoveryException(status: String) : Exception(status)

  private companion object {
    /** What every sealed backup starts with: nitro-crypto's format magic, `ncbk`. */
    val MAGIC = byteArrayOf(0x6e, 0x63, 0x62, 0x6b)
  }
}
