package com.melisaerp.nativeterminal

enum class Screen { LOADING, LOGIN, HOME, CUSTOMERS, SALE, RECEIPTS, SETTINGS, PRODUCTS, RATES, PRINT_SETTINGS, SOUND_SETTINGS, CONNECTION, ORDERS, PICKING }
fun parentScreen(screen: Screen, signedIn: Boolean): Screen = if (!signedIn) Screen.LOGIN else when (screen) {
    Screen.SALE -> Screen.CUSTOMERS
    Screen.RATES, Screen.PRINT_SETTINGS, Screen.SOUND_SETTINGS, Screen.CONNECTION -> Screen.SETTINGS
    Screen.PICKING -> Screen.ORDERS
    else -> Screen.HOME
}
