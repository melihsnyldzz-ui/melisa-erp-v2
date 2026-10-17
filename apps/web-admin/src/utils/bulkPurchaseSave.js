// Keep a created draft's identity even if its finalization fails. Never retry an
// ambiguous create response automatically: the server may already have committed.
export async function saveBulkPurchaseGroups({ groups, makePayload, createDraft, finalizeDraft, finalize = false, onCreated, onResult }) {
  for (const group of groups) {
    let draft;
    try {
      const response = await createDraft(makePayload(group));
      draft = response?.data;
      if (!draft?.id) throw new Error('Oluşan alış fişinin kimliği alınamadı.');
    } catch (error) {
      onResult({ ok: false, supplierName: group.supplierName, creationNeedsReview: true, message: `${error.message || 'Kayıt sonucu alınamadı.'} Alış Fişleri listesinden sonucu kontrol edin; bu sepet yeniden gönderilmez.` });
      return { stopped: true, creationNeedsReview: true };
    }

    // Remove only the rows whose creation was acknowledged, before finalizing.
    onCreated(group, draft);
    const result = { ok: true, supplierName: group.supplierName, rowCount: group.rows.length, draftId: draft.id, documentNo: draft.documentNo, status: draft.status, message: 'Taslak oluştu' };
    if (finalize) {
      try {
        const response = await finalizeDraft(draft.id);
        Object.assign(result, { status: response.data.status, documentNo: response.data.documentNo, message: 'Kesinleşti' });
      } catch (error) {
        onResult({ ...result, ok: false, message: `${error.message || 'Kesinleştirme sonucu alınamadı.'} Mevcut fişi açıp durumunu kontrol edin; yeni fiş oluşturmayın.` });
        return { stopped: true, creationNeedsReview: false };
      }
    }
    onResult(result);
  }
  return { stopped: false, creationNeedsReview: false };
}
