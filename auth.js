// ============================================
// AUTH SYSTEM - Login & User Management
// ============================================

// Standard admin bruger (kan ændres senere)
const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123', // Skal ændres ved første login!
  email: 'admin@vinlager.dk',
  role: 'admin',
  created: new Date().toISOString()
};

// User storage
const USERS_KEY = 'vinlager_users';
const CURRENT_USER_KEY = 'vinlager_current_user';
const ACTIVITY_LOG_KEY = 'vinlager_activity_log';

// Initialize users storage
function initUsersStorage() {
  const users = localStorage.getItem(USERS_KEY);
  if (!users) {
    // Opret standard admin bruger
    const defaultUsers = [DEFAULT_ADMIN];
    localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
  }
}

// Get all users
function getAllUsers() {
  initUsersStorage();
  const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  return users;
}

// Save users
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// Get current user
function getCurrentUser() {
  const userStr = localStorage.getItem(CURRENT_USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// Set current user
function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

// Check if user is logged in
function isLoggedIn() {
  return getCurrentUser() !== null;
}

// Check if user is admin
function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin';
}

// Login
function login(username, password) {
  const users = getAllUsers();
  const user = users.find(u => u.username === username);
  
  if (!user) {
    return { success: false, error: 'Brugernavn eller password forkert' };
  }
  
  if (user.password !== password) {
    return { success: false, error: 'Brugernavn eller password forkert' };
  }
  
  // Log login aktivitet
  logActivity('login', user.username, null);
  
  // Set current user (uden password)
  const { password: _, ...userWithoutPassword } = user;
  setCurrentUser(userWithoutPassword);
  
  return { success: true, user: userWithoutPassword };
}

// Logout
function logout() {
  const user = getCurrentUser();
  if (user) {
    logActivity('logout', user.username, null);
  }
  setCurrentUser(null);
}

// Available roles
const ROLES = {
  USER: 'user',           // Standard bruger - kan lave optælling
  OVERTJENER: 'overtjener', // Overtjener - kan lave optælling og se rapporter
  DIREKTØR: 'direktør',    // Direktør - kan lave optælling, se rapporter og administrere
  ADMIN: 'admin'           // Admin - fuld adgang
};

// Get role display name
function getRoleDisplayName(role) {
  const roleNames = {
    'user': 'Bruger (Optælling)',
    'overtjener': 'Overtjener',
    'direktør': 'Direktør',
    'admin': 'Admin'
  };
  return roleNames[role] || role;
}

// Create new user (admin only)
function createUser(username, password, email, role = 'user') {
  if (!isAdmin()) {
    return { success: false, error: 'Kun admin kan oprette brugere' };
  }
  
  const users = getAllUsers();
  
  // Tjek om brugernavn allerede eksisterer
  if (users.find(u => u.username === username)) {
    return { success: false, error: 'Brugernavn findes allerede' };
  }
  
  // Tjek om email allerede eksisterer
  if (users.find(u => u.email === email)) {
    return { success: false, error: 'Email findes allerede' };
  }
  
  // Valider role
  const validRoles = Object.values(ROLES);
  if (!validRoles.includes(role)) {
    return { success: false, error: 'Ugyldig rolle' };
  }
  
  const newUser = {
    username,
    password, // I produktion skal dette hashes med bcrypt
    email,
    role,
    created: new Date().toISOString()
  };
  
  users.push(newUser);
  saveUsers(users);
  
  logActivity('user_created', getCurrentUser().username, `Oprettet bruger: ${username} (${getRoleDisplayName(role)})`);
  
  return { success: true, user: newUser };
}

// Update user (admin only)
function updateUser(username, updates) {
  if (!isAdmin()) {
    return { success: false, error: 'Kun admin kan opdatere brugere' };
  }
  
  const users = getAllUsers();
  const userIndex = users.findIndex(u => u.username === username);
  
  if (userIndex === -1) {
    return { success: false, error: 'Bruger ikke fundet' };
  }
  
  users[userIndex] = { ...users[userIndex], ...updates };
  saveUsers(users);
  
  logActivity('user_updated', getCurrentUser().username, `Opdateret bruger: ${username}`);
  
  return { success: true, user: users[userIndex] };
}

// Delete user (admin only)
function deleteUser(username) {
  if (!isAdmin()) {
    return { success: false, error: 'Kun admin kan slette brugere' };
  }
  
  if (username === getCurrentUser().username) {
    return { success: false, error: 'Du kan ikke slette din egen bruger' };
  }
  
  const users = getAllUsers();
  const filtered = users.filter(u => u.username !== username);
  
  if (filtered.length === users.length) {
    return { success: false, error: 'Bruger ikke fundet' };
  }
  
  saveUsers(filtered);
  
  logActivity('user_deleted', getCurrentUser().username, `Slettet bruger: ${username}`);
  
  return { success: true };
}

// Password reset (mock - klar til backend integration)
function requestPasswordReset(emailOrUsername) {
  const users = getAllUsers();
  // Søg på både email og brugernavn
  const user = users.find(u => u.email === emailOrUsername || u.username === emailOrUsername);
  
  if (!user) {
    // Returnerer stadig success for sikkerhed (ikke afslør hvilke emails der findes)
    return { success: true, message: 'Hvis emailen/brugernavnet findes, er et reset link sendt' };
  }
  
  // Mock: I produktion send email med reset token
  logActivity('password_reset_requested', user.username, `Password reset anmodet for: ${emailOrUsername}`);
  
  return { success: true, message: 'Hvis emailen/brugernavnet findes, er et reset link sendt', user: { email: user.email, username: user.username } };
}

// Reset password (mock) - kan bruge email eller brugernavn
function resetPassword(emailOrUsername, newPassword, token = null) {
  const users = getAllUsers();
  const userIndex = users.findIndex(u => u.email === emailOrUsername || u.username === emailOrUsername);
  
  if (userIndex === -1) {
    return { success: false, error: 'Bruger ikke fundet' };
  }
  
  // Mock: I produktion valider token
  users[userIndex].password = newPassword; // Skal hashes i produktion
  saveUsers(users);
  
  logActivity('password_reset', users[userIndex].username, 'Password nulstillet');
  
  return { success: true, user: users[userIndex] };
}

// Change password (når bruger er logget ind)
function changePassword(currentPassword, newPassword) {
  const user = getCurrentUser();
  if (!user) {
    return { success: false, error: 'Ikke logget ind' };
  }
  
  const users = getAllUsers();
  const userIndex = users.findIndex(u => u.username === user.username);
  
  if (users[userIndex].password !== currentPassword) {
    return { success: false, error: 'Nuværende password forkert' };
  }
  
  users[userIndex].password = newPassword; // Skal hashes i produktion
  saveUsers(users);
  
  logActivity('password_changed', user.username, 'Password ændret');
  
  return { success: true };
}

// Activity log
function logActivity(action, username, details) {
  const logs = getActivityLogs();
  const logEntry = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleString('da-DK'),
    action, // 'login', 'logout', 'stock_count', 'user_created', etc.
    username,
    details: details || ''
  };
  
  logs.unshift(logEntry); // Tilføj øverst
  if (logs.length > 1000) {
    logs.splice(1000); // Begræns til 1000 entries
  }
  
  localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(logs));
  
  return logEntry;
}

// Get activity logs
function getActivityLogs(filter = {}) {
  const logsStr = localStorage.getItem(ACTIVITY_LOG_KEY);
  let logs = [];
  
  if (logsStr) {
    try {
      logs = JSON.parse(logsStr);
    } catch {
      logs = [];
    }
  }
  
  // Apply filters
  if (filter.username) {
    logs = logs.filter(l => l.username === filter.username);
  }
  
  if (filter.action) {
    logs = logs.filter(l => l.action === filter.action);
  }
  
  if (filter.fromDate) {
    const from = new Date(filter.fromDate);
    logs = logs.filter(l => new Date(l.timestamp) >= from);
  }
  
  if (filter.toDate) {
    const to = new Date(filter.toDate);
    logs = logs.filter(l => new Date(l.timestamp) <= to);
  }
  
  return logs;
}

// Log stock count activity
function logStockCount(vinId, oldCount, newCount, username = null) {
  const user = username || (getCurrentUser()?.username || 'ukendt');
  const details = `Vin: ${vinId}, ${oldCount} → ${newCount} (${newCount > oldCount ? '+' : ''}${newCount - oldCount})`;
  return logActivity('stock_count', user, details);
}

// Export for global use
if (typeof window !== 'undefined') {
  window.auth = {
    initUsersStorage,
    getAllUsers,
    getCurrentUser,
    setCurrentUser,
    isLoggedIn,
    isAdmin,
    login,
    logout,
    createUser,
    updateUser,
    deleteUser,
    requestPasswordReset,
    resetPassword,
    changePassword,
    logActivity,
    getActivityLogs,
    logStockCount,
    ROLES,
    getRoleDisplayName
  };
}
