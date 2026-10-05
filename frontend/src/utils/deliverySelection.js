/** Whole-selection eligibility for delivery assignment actions. */
export function deliverySelectionEligibility(tasks, selectedIds) {
  const byId = new Map((tasks || []).map((task) => [task.id, task]));
  const unknown = selectedIds.filter((id) => !byId.has(id));
  const selected = selectedIds.map((id) => byId.get(id)).filter(Boolean);
  const label = (task) => task.recipient_name || task.id;
  const notReady = selected.filter((task) => task.status !== 'ready');
  const notInDelivery = selected.filter((task) => task.status !== 'in_delivery');
  const assignEligible = selectedIds.length > 0 && unknown.length === 0 && notReady.length === 0;
  const reassignEligible = selectedIds.length > 0 && unknown.length === 0 && notInDelivery.length === 0;
  const list = (items) => items.map(label).join('، ');
  let assignReason = '';
  let reassignReason = '';
  if (selectedIds.length === 0) {
    assignReason = 'حدد مهاماً جاهزة للاستلام لإنشاء التكليف.';
    reassignReason = 'حدد مهاماً جارٍ توصيلها لنقل التكليف.';
  } else if (unknown.length > 0) {
    assignReason = 'بعض المهام المحددة لم تعد ضمن السجل الظاهر. ألغِ التحديد وأعد اختيار المهام الجاهزة.';
    reassignReason = 'بعض المهام المحددة لم تعد ضمن السجل الظاهر. ألغِ التحديد وأعد اختيار المهام الجاري توصيلها.';
  } else {
    if (!assignEligible) {
      assignReason = `إنشاء التكليف يتطلب أن تكون كل المهام المحددة جاهزة للاستلام. أزل من التحديد: ${list(notReady)}.`;
    }
    if (!reassignEligible) {
      reassignReason = `نقل التكليف يتطلب أن تكون كل المهام المحددة جارٍ توصيلها. أزل من التحديد: ${list(notInDelivery)}.`;
    }
  }

  return { assignEligible, reassignEligible, assignReason, reassignReason };
}
