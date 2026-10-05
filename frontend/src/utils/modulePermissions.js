const DRIVER_ROLES = ['driver', 'delivery_driver'];

// Same role lists as ModulePermission. support, governance, and beneficiary_policy
// are explicit grants and are intentionally absent here.
const MODULE_ROLES = {
  beneficiaries: ['assistant_admin', 'reception', 'staff', 'readonly'],
  daily_beneficiaries: ['assistant_admin', 'reception', 'staff', 'readonly'],
  warehouse: ['assistant_admin', 'warehouse', 'staff', 'readonly'],
  staff: ['assistant_admin'],
  representatives: ['assistant_admin', 'staff'],
  delivery: ['assistant_admin', 'staff', 'delivery_driver', 'driver'],
  receiver: ['assistant_admin', 'reception', 'staff', 'warehouse', 'readonly', 'delivery_driver', 'driver'],
  settings: ['assistant_admin', 'reception', 'staff', 'warehouse', 'readonly', 'delivery_driver', 'driver'],
};

function moduleAccountOpen(user) {
  return Boolean(user) && user.is_active !== false && user.must_change_password !== true;
}

function supportAction(user, action) {
  if (user.role === 'readonly' && action !== 'view') return false;
  const support = user.permissions?.support;
  if (support?.[action] !== true) return false;
  if (action === 'export' && support.view !== true) return false;
  return true;
}

export function hasModuleAction(user, module, action) {
  if (!moduleAccountOpen(user) || !module || !action) return false;
  if (user.role === 'admin') return true;
  if (DRIVER_ROLES.includes(user.role)) return false;
  if (module === 'notifications') return true;
  if (module === 'users' || module === 'audit') return false;
  if (module === 'support') return supportAction(user, action);
  if (module === 'governance') return user.permissions?.governance?.[action] === true;
  if (module === 'beneficiary_policy') return user.permissions?.beneficiary_policy?.[action] === true;
  if (user.role === 'readonly' && action !== 'view') return false;

  const roles = MODULE_ROLES[module];
  if (!roles?.includes(user.role)) return false;

  const grants = user.permissions?.[module];
  if (!grants) return module !== 'settings' || action === 'view';
  return grants.view === true && grants[action] === true;
}

export function canViewRepresentatives(user) {
  return hasModuleAction(user, 'representatives', 'view');
}

export function canViewSupport(user) {
  return hasModuleAction(user, 'support', 'view');
}
