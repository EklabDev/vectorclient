import { useState, useEffect } from 'react';
import { ApiClient } from '../../services/api';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  displayName: string;
  twoFactorEnabled: boolean;
  createdAt: string;
}

interface TwoFactorSetupData {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
  otpauthUrl: string;
}

export function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // 2FA Setup / Regenerate State
  const [setupData, setSetupData] = useState<TwoFactorSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorSuccess, setTwoFactorSuccess] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [copiedCodes, setCopiedCodes] = useState(false);

  // 2FA Disable State
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState('');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await ApiClient.getProfile();
      setProfile(data);
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await ApiClient.changePassword(currentPassword, newPassword);
      setPasswordSuccess(res.message || 'Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError((err as Error).message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleStart2FASetup = async () => {
    setTwoFactorError('');
    setTwoFactorSuccess('');
    setTwoFactorLoading(true);

    try {
      const data = await ApiClient.setup2FA();
      setSetupData(data);
      setVerificationCode('');
      setCopiedCodes(false);
    } catch (err) {
      setTwoFactorError((err as Error).message);
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleConfirm2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData) return;

    setTwoFactorError('');
    setTwoFactorSuccess('');
    setTwoFactorLoading(true);

    try {
      const res = await ApiClient.confirm2FA(
        setupData.secret,
        verificationCode,
        setupData.backupCodes
      );
      setTwoFactorSuccess(res.message || 'Two-factor authentication successfully enabled.');
      setSetupData(null);
      await fetchProfile();
    } catch (err) {
      setTwoFactorError((err as Error).message);
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableError('');
    setDisableLoading(true);

    try {
      const res = await ApiClient.disable2FA(disablePassword);
      setTwoFactorSuccess(res.message || 'Two-factor authentication disabled.');
      setShowDisableModal(false);
      setDisablePassword('');
      await fetchProfile();
    } catch (err) {
      setDisableError((err as Error).message);
    } finally {
      setDisableLoading(false);
    }
  };

  const copyBackupCodes = () => {
    if (!setupData?.backupCodes) return;
    navigator.clipboard.writeText(setupData.backupCodes.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2500);
  };

  if (loading) {
    return (
      <div style={{ padding: 24, color: '#6b7280', fontSize: 14 }}>
        Loading user profile...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: '#111827' }}>
          Account Security & Profile
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: '#4b5563' }}>
          Manage your credentials, two-factor authentication, and account settings.
        </p>
      </div>

      {/* Account Info Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          padding: 24,
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: '#111827' }}>
          Profile Information
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <span style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Username
            </span>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#111827', marginTop: 4 }}>
              {profile?.username}
            </div>
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Display Name
            </span>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#111827', marginTop: 4 }}>
              {profile?.displayName}
            </div>
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email Address
            </span>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#111827', marginTop: 4 }}>
              {profile?.email}
            </div>
          </div>
          <div>
            <span style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              2FA Status
            </span>
            <div style={{ marginTop: 4 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 10px',
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: profile?.twoFactorEnabled ? '#ecfdf5' : '#fef3c7',
                  color: profile?.twoFactorEnabled ? '#065f46' : '#92400e',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: profile?.twoFactorEnabled ? '#10b981' : '#f59e0b',
                  }}
                />
                {profile?.twoFactorEnabled ? '2FA Enabled' : '2FA Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Factor Authentication Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          padding: 24,
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px', color: '#111827' }}>
              Two-Factor Authentication (2FA)
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              Protect your account by requiring an authenticator code (TOTP) upon sign in.
            </p>
          </div>
          {!setupData && (
            <div style={{ display: 'flex', gap: 10 }}>
              {profile?.twoFactorEnabled ? (
                <>
                  <button
                    onClick={handleStart2FASetup}
                    disabled={twoFactorLoading}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      backgroundColor: '#ffffff',
                      color: '#374151',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {twoFactorLoading ? 'Loading...' : 'Regenerate 2FA'}
                  </button>
                  <button
                    onClick={() => setShowDisableModal(true)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      border: '1px solid #fecaca',
                      backgroundColor: '#fef2f2',
                      color: '#b91c1c',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Disable 2FA
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStart2FASetup}
                  disabled={twoFactorLoading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: '#0d9488',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {twoFactorLoading ? 'Loading...' : 'Enable 2FA'}
                </button>
              )}
            </div>
          )}
        </div>

        {twoFactorSuccess && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {twoFactorSuccess}
          </div>
        )}

        {twoFactorError && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {twoFactorError}
          </div>
        )}

        {/* 2FA Setup / Regenerate Active View */}
        {setupData && (
          <div
            style={{
              marginTop: 16,
              padding: 20,
              backgroundColor: '#f9fafb',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#111827' }}>
                Scan QR Code with Authenticator App
              </h3>
              <button
                type="button"
                onClick={() => setSetupData(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 13,
                  color: '#6b7280',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Cancel
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
              {/* QR Code */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <img
                  src={setupData.qrCodeDataUrl}
                  alt="2FA QR Code"
                  style={{ width: 180, height: 180, display: 'block' }}
                />
                <span style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
                  Compatible with Google Authenticator, 1Password, Authy
                </span>
              </div>

              {/* Instructions and Secret Key */}
              <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <span style={{ fontSize: 13, color: '#4b5563', fontWeight: 500 }}>
                    Manual Entry Secret Key:
                  </span>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 14,
                      fontWeight: 600,
                      backgroundColor: '#ffffff',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      color: '#0d9488',
                      letterSpacing: 2,
                      marginTop: 4,
                      userSelect: 'all',
                    }}
                  >
                    {setupData.secret}
                  </div>
                </div>

                {/* Backup Recovery Codes */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      Backup Recovery Codes
                    </span>
                    <button
                      type="button"
                      onClick={copyBackupCodes}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        borderRadius: 4,
                        border: '1px solid #d1d5db',
                        backgroundColor: '#ffffff',
                        color: copiedCodes ? '#059669' : '#374151',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      {copiedCodes ? '✓ Copied' : 'Copy Codes'}
                    </button>
                  </div>
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280' }}>
                    Save these single-use codes safely. If you lose your authenticator, each code can be used once to log in.
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 6,
                      backgroundColor: '#ffffff',
                      padding: 10,
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      textAlign: 'center',
                      color: '#111827',
                    }}
                  >
                    {setupData.backupCodes.map((code, idx) => (
                      <span key={idx} style={{ padding: '3px 0' }}>
                        {code}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Confirm Code Form */}
                <form onSubmit={handleConfirm2FA} style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <input
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    maxLength={6}
                    required
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      fontSize: 15,
                      letterSpacing: 2,
                      textAlign: 'center',
                      fontWeight: 600,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={twoFactorLoading || verificationCode.length !== 6}
                    style={{
                      padding: '9px 18px',
                      borderRadius: 6,
                      border: 'none',
                      backgroundColor: verificationCode.length === 6 ? '#0d9488' : '#9ca3af',
                      color: '#ffffff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: verificationCode.length === 6 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {twoFactorLoading ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Change Password Card */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          padding: 24,
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px', color: '#111827' }}>
          Change Password
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#6b7280' }}>
          Update your password to a strong phrase. Changing your password invalidates all existing active sessions.
        </p>

        {passwordSuccess && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {passwordSuccess}
          </div>
        )}

        {passwordError && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 6,
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {passwordError}
          </div>
        )}

        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 440 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
              New Password (min 8 characters)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginTop: 6 }}>
            <button
              type="submit"
              disabled={passwordLoading}
              style={{
                padding: '10px 18px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: passwordLoading ? '#9ca3af' : '#0d9488',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                cursor: passwordLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {passwordLoading ? 'Updating Password...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Disable 2FA Modal */}
      {showDisableModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 8,
              padding: 24,
              width: '100%',
              maxWidth: 420,
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600, color: '#111827' }}>
              Confirm Disabling 2FA
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#4b5563' }}>
              To disable two-factor authentication, please enter your current account password to confirm your identity.
            </p>

            {disableError && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: 13,
                  marginBottom: 14,
                }}
              >
                {disableError}
              </div>
            )}

            <form onSubmit={handleDisable2FA}>
              <input
                type="password"
                placeholder="Current Password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid #d1d5db',
                  fontSize: 14,
                  boxSizing: 'border-box',
                  marginBottom: 16,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowDisableModal(false);
                    setDisablePassword('');
                    setDisableError('');
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disableLoading}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: '#b91c1c',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: disableLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {disableLoading ? 'Disabling...' : 'Confirm Disable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

