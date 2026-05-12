import React, { useEffect, useState } from 'react';
import { useMission } from '../context/MissionContext';

const UserRoleIcon = ({ role, active = false }) => {
  const stroke = active ? 'var(--cyan-primary)' : 'var(--text-muted)';

  if (role === 'OBSERVER') {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12z"></path>
        <circle cx="12" cy="12" r="2.8"></circle>
      </svg>
    );
  }

  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19l5.5-5.5"></path>
      <path d="M14.5 9.5L20 4"></path>
      <path d="M8 6l3 3"></path>
      <path d="M13 11l5 5"></path>
      <path d="M5 21l4-1 9-9-3-3-9 9-1 4z"></path>
    </svg>
  );
};

const inputStyle = {
  width: '100%',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-main)',
  padding: '12px 14px',
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  outline: 'none'
};

export default function ProfileHub() {
  const { users, currentUser, loginUser, logoutUser, updateUserName, createUser } = useMission();
  const [nameDrafts, setNameDrafts] = useState({});
  const [loginForm, setLoginForm] = useState({ loginId: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [createForm, setCreateForm] = useState({ name: '', loginId: '', password: '', role: 'OPERATOR' });
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    setNameDrafts(Object.fromEntries(users.map((user) => [user.id, user.name])));
  }, [users]);

  const handleLogin = () => {
    const result = loginUser(loginForm.loginId, loginForm.password);
    if (!result?.ok) {
      setLoginError(result?.error === 'INVALID_CREDENTIALS' ? 'INVALID LOGIN ID OR PASSWORD' : 'LOGIN FAILED');
      return;
    }
    setLoginError('');
    setLoginForm({ loginId: '', password: '' });
  };

  const handleCreateUser = () => {
    const result = createUser(createForm);
    if (!result?.ok) {
      const nextError = {
        OBSERVER_ONLY: 'ONLY OBSERVER CAN CREATE USERS',
        MISSING_FIELDS: 'ALL USER FIELDS ARE REQUIRED',
        LOGIN_ID_EXISTS: 'LOGIN ID ALREADY EXISTS'
      }[result?.error] || 'FAILED TO CREATE USER';
      setCreateError(nextError);
      return;
    }
    setCreateError('');
    setCreateForm({ name: '', loginId: '', password: '', role: 'OPERATOR' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '40px', gap: '24px', background: 'var(--bg-dark)', overflowY: 'auto' }}>
      <div className="glass-panel" style={{ padding: '28px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
        <div>
          <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.18em', marginBottom: '10px' }}>USER_ACCESS_PROFILE</div>
          <h2 className="display text-main" style={{ margin: 0, fontSize: '30px' }}>
            {currentUser ? `ACTIVE SESSION // ${currentUser.role} ${currentUser.name.toUpperCase()}` : 'LOGIN AUTHENTICATION'}
          </h2>
          <div className="mono text-muted" style={{ fontSize: '11px', marginTop: '10px' }}>
            {currentUser ? `${currentUser.role} AUTHENTICATED` : 'ENTER LOGIN ID AND PASSWORD'}
          </div>
        </div>
        {currentUser && (
          <button className="btn" style={{ padding: '12px 18px', fontSize: '12px' }} onClick={logoutUser}>
            LOGOUT
          </button>
        )}
      </div>

      {!currentUser && (
        <div className="glass-panel" style={{ padding: '28px', maxWidth: '520px' }}>
          <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.14em', marginBottom: '18px' }}>SECURE LOGIN</div>
          <div style={{ display: 'grid', gap: '14px' }}>
            <input
              value={loginForm.loginId}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, loginId: e.target.value }))}
              placeholder="LOGIN ID"
              style={inputStyle}
            />
            <input
              value={loginForm.password}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="PASSWORD"
              type="password"
              style={inputStyle}
            />
            {loginError && (
              <div className="mono" style={{ fontSize: '10px', color: 'var(--orange-alert)' }}>{loginError}</div>
            )}
            <button className="btn btn-primary" style={{ padding: '14px 16px', fontSize: '12px' }} onClick={handleLogin}>
              LOGIN
            </button>
          </div>
        </div>
      )}

      {currentUser && (
        <>
          {currentUser.role === 'OBSERVER' && (
            <div className="glass-panel" style={{ padding: '28px' }}>
              <div className="mono text-cyan" style={{ fontSize: '11px', letterSpacing: '0.14em', marginBottom: '18px' }}>CREATE USER</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.9fr auto', gap: '12px', alignItems: 'end' }}>
                <div>
                  <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '8px' }}>NAME</div>
                  <input value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '8px' }}>LOGIN ID</div>
                  <input value={createForm.loginId} onChange={(e) => setCreateForm((prev) => ({ ...prev, loginId: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '8px' }}>PASSWORD</div>
                  <input value={createForm.password} onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))} type="password" style={inputStyle} />
                </div>
                <div>
                  <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '8px' }}>ROLE</div>
                  <select value={createForm.role} onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value }))} style={inputStyle}>
                    <option value="OPERATOR">OPERATOR</option>
                    <option value="OBSERVER">OBSERVER</option>
                  </select>
                </div>
                <button className="btn btn-primary" style={{ padding: '12px 14px', fontSize: '11px' }} onClick={handleCreateUser}>
                  CREATE
                </button>
              </div>
              {createError && (
                <div className="mono" style={{ fontSize: '10px', color: 'var(--orange-alert)', marginTop: '12px' }}>{createError}</div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(280px, 1fr))', gap: '24px' }}>
            {users.map((user) => {
              const isActive = currentUser?.id === user.id;
              return (
                <div
                  key={user.id}
                  className="glass-panel"
                  style={{
                    padding: '26px',
                    border: isActive ? '1px solid var(--cyan-primary)' : '1px solid var(--border-color)',
                    background: isActive ? 'rgba(0,229,255,0.06)' : 'rgba(255,255,255,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '54px', height: '54px', borderRadius: '14px', border: `1px solid ${isActive ? 'var(--cyan-primary)' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)' }}>
                        <UserRoleIcon role={user.role} active={isActive} />
                      </div>
                      <div>
                        <div className="mono text-main" style={{ fontSize: '16px', fontWeight: 'bold' }}>{`${user.role} ${user.name}`.toUpperCase()}</div>
                        <div className="mono text-muted" style={{ fontSize: '10px', marginTop: '6px' }}>{user.loginId} // {user.status}</div>
                      </div>
                    </div>
                    {isActive && (
                      <span className="mono text-cyan" style={{ fontSize: '10px', letterSpacing: '0.12em' }}>ONLINE</span>
                    )}
                  </div>

                  <div className="mono text-muted" style={{ fontSize: '11px', marginTop: '22px', lineHeight: 1.7 }}>
                    {user.role === 'OPERATOR'
                      ? 'Direct flight control, mission execution, and tactical feed supervision.'
                      : 'Passive surveillance, mission observation, and post-mission review access.'}
                  </div>

                  {currentUser.role === 'OBSERVER' && (
                    <div style={{ marginTop: '18px' }}>
                      <div className="mono text-muted" style={{ fontSize: '9px', marginBottom: '8px' }}>DISPLAY NAME (ROLE AUTO-ATTACHED IN UI)</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          value={nameDrafts[user.id] || ''}
                          onChange={(e) => setNameDrafts((prev) => ({ ...prev, [user.id]: e.target.value }))}
                          style={inputStyle}
                        />
                        <button
                          className="btn"
                          style={{ padding: '10px 12px', fontSize: '10px' }}
                          onClick={() => updateUserName(user.id, nameDrafts[user.id])}
                        >
                          SAVE
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
