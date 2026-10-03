export async function runTerminalSaleSubmissionTransaction({ transaction, operations }) {
  let transactionFinished = false;

  await transaction.begin();
  try {
    await operations.assertSchema();
    await operations.acquireLock();

    const ledger = await operations.readLedger();
    if (ledger) {
      const replayResult = await operations.replay(ledger);
      try {
        await transaction.commit();
      } catch (error) {
        error.transactionOutcome = 'unverified';
        throw error;
      }
      transactionFinished = true;
      return replayResult;
    }

    await operations.assertNoLegacySale();
    const prepared = await operations.prepareNewSale();
    const ledgerId = await operations.reserveLedger(prepared);
    const draft = await operations.createDraft(prepared, ledgerId);
    const finalized = await operations.finalizeDraft(draft, prepared, ledgerId);
    await operations.writeSubmitAudit(finalized, prepared, ledgerId);
    await operations.completeLedger(finalized, prepared, ledgerId);

    try {
      await transaction.commit();
    } catch (error) {
      error.transactionOutcome = 'unverified';
      throw error;
    }
    transactionFinished = true;
    return operations.toCreatedResult(finalized, prepared, ledgerId);
  } catch (error) {
    if (!transactionFinished) {
      try {
        await transaction.rollback();
      } catch {
        error.transactionOutcome = 'unverified';
      }
    }
    throw error;
  }
}
