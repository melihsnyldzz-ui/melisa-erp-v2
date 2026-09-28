package com.melisaerp.nativeterminal

import android.app.Application
import com.melisaerp.nativeterminal.data.*

class TerminalApplication : Application() {
    val repository by lazy { TerminalRepository(LocalStore.create(this), Vault(this)) }
}
