package com.melisaerp.nativeterminal

import com.melisaerp.nativeterminal.model.*
import org.junit.Assert.*
import org.junit.Test

class EmptyDraftExitTest {
    private val empty = Draft(owner="owner",actorId=8,customer=Customer(3,"cash","Cash","USD"))
    private val quote = Quote(1,"P1","Product",stock="1",unitPrice="10.00",currency="USD",
        exchangeRate="40",customerId=3,quoteToken="signed",quotedAt="now")

    @Test fun onlyEmptyUnsubmittedDraftCanBeDiscarded() {
        assertTrue(empty.discardableOnExit)
        assertFalse(empty.add(quote,1).discardableOnExit)
        for (state in DraftState.entries.filter { it != DraftState.DRAFT })
            assertFalse(empty.copy(state=state).discardableOnExit)
        assertFalse(empty.copy(submissionJson="frozen payload").discardableOnExit)
        assertFalse(empty.copy(receipt=Receipt(1,"R1","today","FINALIZED","Cash","USD","10.00")).discardableOnExit)
    }
    @Test fun removingLastItemMakesUnsubmittedDraftDiscardable() {
        assertTrue(empty.add(quote,1).remove(quote.productId).discardableOnExit)
    }
}
