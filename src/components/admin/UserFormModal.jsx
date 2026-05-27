import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Send, Copy, Check, AlertCircle } from 'lucide-react';
import { sendInviteEmail } from '@/functions/sendInviteEmail';

async function doSendInvite(email, full_name, assigned_properties, properties) {
  const hotel_names = (assigned_properties || [])
    .map(id => properties.find(p => p.id === id)?.name)
    .filter(Boolean);

  const result = await sendInviteEmail({
    email,
    full_name,
    hotel_names,
    app_url: window.location.origin,
  });

  if (result?.data?.error) throw new Error(result.data.error);
  return result;
}

export default function UserFormModal({ profile, properties, onClose, onSaved }) {
  const isEdit = !!profile;
  const [form, setForm] = useState({
    email: profile?.email || '',
    first_name: profile?.full_name?.split(' ')[0] || '',
    last_name: profile?.full_name?.split(' ').slice(1).join(' ') || '',
    role: profile?.role || 'property_user',
    assigned_properties: profile?.assigned_properties || [],
    is_active: profile?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const toggle = (id) => {
    setForm(f => ({
      ...f,
      assigned_properties: f.assigned_properties.includes(id)
        ? f.assigned_properties.filter(x => x !== id)
        : [...f.assigned_properties, id],
    }));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSave = async (sendInvite = false) => {
    if (!form.email) return;
    setSaving(true);
    setEmailError(null);

    const now = new Date().toISOString();
    const full_name = `${form.first_name} ${form.last_name}`.trim();
    const data = { email: form.email, full_name, role: form.role, assigned_properties: form.assigned_properties };

    if (sendInvite) {
      data.invite_status = 'invited';
      data.invite_sent_at = now;
    } else if (!isEdit) {
      data.invite_status = 'not_invited';
    }

    if (isEdit) {
      data.is_active = form.is_active;
      await base44.entities.UserProfile.update(profile.id, data);
    } else {
      await base44.entities.UserProfile.create(data);
    }

    if (sendInvite) {
      try {
        await doSendInvite(form.email, full_name, form.assigned_properties, properties);
        setSaving(false);
        onSaved({ emailSent: true, email: form.email });
      } catch (err) {
        setSaving(false);
        setEmailError(err.message || 'Failed to send invite email. Use the copy link below to share manually.');
      }
      return;
    }

    setSaving(false);
    onSaved({ emailSent: false });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-bold text-lg">{isEdit ? 'Edit User' : 'Add User'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Email *</label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              disabled={isEdit}
              placeholder="user@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">First Name</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                placeholder="First"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Last Name</label>
              <input
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                placeholder="Last"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Role</label>
            <select
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            >
              <option value="property_user">Property User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {form.role === 'property_user' && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                Assigned Properties ({form.assigned_properties.length} selected)
              </label>
              <div className="border border-border rounded-lg max-h-48 overflow-y-auto divide-y divide-border">
                {properties.map(p => (
                  <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.assigned_properties.includes(p.id)}
                      onChange={() => toggle(p.id)}
                      className="rounded"
                    />
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.city}, {p.state}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
          {isEdit && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm font-medium cursor-pointer">Active (can log in)</label>
            </div>
          )}

          {/* Email error + copy link fallback */}
          {emailError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
              <div className="flex items-start gap-2 text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold">Email delivery failed</div>
                  <div className="text-xs mt-0.5">{emailError}</div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">Share this link manually instead:</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-2 truncate">
                    {window.location.origin}
                  </code>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted shrink-0"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedLink ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The user profile was saved. They can log in at this URL once their account is set up.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted">
            {emailError ? 'Close' : 'Cancel'}
          </button>
          {!emailError && (
            <>
              {isEdit && (
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving || !form.email}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {saving ? 'Sending...' : 'Save & Resend Invite'}
                </button>
              )}
              <button
                onClick={() => handleSave(isEdit ? false : false)}
                disabled={saving || !form.email}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: '#2d4b5e' }}
              >
                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Without Inviting'}
              </button>
              {!isEdit && (
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving || !form.email}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: '#2d4b5e' }}
                >
                  <Send className="w-3.5 h-3.5" />
                  {saving ? 'Sending...' : 'Save & Send Invite'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}