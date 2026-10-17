package com.melisaerp.nativeterminal.scanner

/** One activity claim owns delivery. Old releases and queued events cannot affect its replacement. */
internal class ForegroundScanDelivery {
    private var owner: Any? = null
    private var action: String? = null
    private var receiver: ((String) -> Unit)? = null

    @Synchronized fun activate(owner: Any, action: String, receiver: (String) -> Unit) {
        require(action.isNotBlank())
        this.owner = owner
        this.action = action
        this.receiver = receiver
    }

    @Synchronized fun isOwner(owner: Any): Boolean = this.owner === owner

    @Synchronized fun release(owner: Any): Boolean {
        if (this.owner !== owner) return false
        this.owner = null
        action = null
        receiver = null
        return true
    }

    /** Fixed vendor actions additionally require the current registration's identity. */
    @Synchronized fun deliver(owner: Any, action: String?, value: String): Boolean {
        if (this.owner !== owner) return false
        return deliver(action, value)
    }

    @Synchronized fun deliver(action: String?, value: String): Boolean {
        if (owner == null || this.action != action) return false
        val receive = receiver ?: return false
        receive(value)
        return true
    }
}
