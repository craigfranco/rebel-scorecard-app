import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus, Search, Edit2, UserX, UserCheck, X, Users, Building2, Send } from 'lucide-react';
import UserFormModal from '@/components/admin/UserFormModal';

function InviteStatusBadge({ status }) {
  const map = {
    active:      { label: 'Active',      bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
    invited:     { label: 'Invited',     bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
    not_invited: { label: 'Not Invited', bg: 'bg-muted',     text: 'text-muted-foreground', border: 'border-border' },
  };
  const s = map[status] || map['not_invited'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [resendingId, setResendingId] = useState(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ['user-profiles'],
    queryFn: () => base44.entities.UserProfile.list('full_name', 200),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 200),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.UserProfile.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-profiles'] }),
  });

  const filtered = profiles.filter(p =>
    !search ||
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleResendInvite = async (profile) => {
    setResendingId(profile.id);
    const now = new Date().toISOString();
    await base44.entities.UserProfile.update(profile.id, {
      invite_status: 'invited',
      invite_sent_at: now,
    });

    const assignedNames = (profile.assigned_properties || [])
      .map(id => properties.find(p => p.id === id)?.name)
      .filter(Boolean);
    const hotelsList = assignedNames.length
      ? `You have been assigned to: ${assignedNames.join(', ')}.`
      : 'Your access covers all properties.';
    const appUrl = window.location.origin;

    await base44.integrations.Core.SendEmail({
      to: profile.email,
      subject: "You've been invited to the REBEL Hotel Scorecard",
      body: `Hi ${profile.full_name || profile.email},

You've been given access to the REBEL Hotel Performance Scorecard.

${hotelsList}

To get started, click the link below to set up your password and log in:
${appUrl}

— The REBEL Hotel Co. Team`,
    });

    qc.invalidateQueries({ queryKey: ['user-profiles'] });
    setResendingId(null);
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
          <span>Balanced Scorecard</span>
          <ChevronRight className="w-3 h-3" />
          <span>Admin Panel</span>
        </div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-white/60 text-xs mt-0.5">Manage users, roles, and property assignments</p>
      </div>

      {/* User Management */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">User Management</h2>
            <span className="text-xs text-muted-foreground">({profiles.length} users)</span>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className="pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background w-48"
                placeholder="Search users..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#2d4b5e' }}
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="py-3 px-4 text-left font-semibold">Name</th>
                <th className="py-3 px-4 text-left font-semibold">Email</th>
                <th className="py-3 px-4 text-center font-semibold">Role</th>
                <th className="py-3 px-4 text-center font-semibold">Hotels</th>
                <th className="py-3 px-4 text-center font-semibold">Status</th>
                <th className="py-3 px-4 text-center font-semibold">Invite Sent</th>
                <th className="py-3 px-4 text-center font-semibold">Last Login</th>
                <th className="py-3 px-4 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(profile => (
                <tr key={profile.id} className="border-b border-border hover:bg-muted/20">
                  <td className="py-3 px-4 font-medium whitespace-nowrap">{profile.full_name || '—'}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{profile.email}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      profile.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {profile.role === 'admin' ? 'Admin' : 'Property User'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {profile.role === 'admin'
                      ? <span className="text-xs text-muted-foreground italic">All</span>
                      : <span className="font-semibold">{(profile.assigned_properties || []).length}</span>
                    }
                  </td>
                  <td className="py-3 px-4 text-center">
                    {profile.is_active
                      ? <InviteStatusBadge status={profile.invite_status || 'not_invited'} />
                      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-50 text-red-600 border-red-200">Deactivated</span>
                    }
                  </td>
                  <td className="py-3 px-4 text-center text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(profile.invite_sent_at)}
                  </td>
                  <td className="py-3 px-4 text-center text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(profile.last_login)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setEditingUser(profile)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {profile.invite_status !== 'active' && profile.is_active && (
                        <button
                          onClick={() => handleResendInvite(profile)}
                          disabled={resendingId === profile.id}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary disabled:opacity-50"
                          title="Resend Invite"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleActive.mutate({ id: profile.id, is_active: !profile.is_active })}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                        title={profile.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {profile.is_active
                          ? <UserX className="w-3.5 h-3.5 text-red-400" />
                          : <UserCheck className="w-3.5 h-3.5 text-green-500" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-muted-foreground text-sm">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Property Assignments */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-lg">Property Assignments</h2>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {properties.map(prop => {
            const directUsers = profiles.filter(p =>
              p.role !== 'admin' && (p.assigned_properties || []).includes(prop.id)
            );
            return (
              <div key={prop.id} className="border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">{prop.name}</div>
                    <div className="text-xs text-muted-foreground">{prop.city}, {prop.state}</div>
                  </div>
                  {directUsers.length === 0 && (
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-orange-600 border border-orange-200">
                      Unassigned
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {directUsers.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">No property users assigned</div>
                  ) : (
                    directUsers.map(u => (
                      <div key={u.id} className="flex items-center justify-between text-xs">
                        <span className="font-medium">{u.full_name || u.email}</span>
                        <button
                          onClick={async () => {
                            const updated = (u.assigned_properties || []).filter(id => id !== prop.id);
                            await base44.entities.UserProfile.update(u.id, { assigned_properties: updated });
                            qc.invalidateQueries({ queryKey: ['user-profiles'] });
                          }}
                          className="text-red-400 hover:text-red-600 ml-2"
                          title="Remove from property"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <QuickAssign
                  propertyId={prop.id}
                  profiles={profiles.filter(p => p.role !== 'admin' && !(p.assigned_properties || []).includes(prop.id))}
                  onAssign={async (userId) => {
                    const u = profiles.find(p => p.id === userId);
                    if (!u) return;
                    const updated = [...(u.assigned_properties || []), prop.id];
                    await base44.entities.UserProfile.update(userId, { assigned_properties: updated });
                    qc.invalidateQueries({ queryKey: ['user-profiles'] });
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {(showAddModal || editingUser) && (
        <UserFormModal
          profile={editingUser}
          properties={properties}
          onClose={() => { setShowAddModal(false); setEditingUser(null); }}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['user-profiles'] }); setShowAddModal(false); setEditingUser(null); }}
        />
      )}
    </div>
  );
}

function QuickAssign({ propertyId, profiles, onAssign }) {
  const [open, setOpen] = useState(false);
  if (profiles.length === 0) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Assign user
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 bg-card border border-border rounded-lg shadow-lg z-10 min-w-[180px] max-h-40 overflow-y-auto">
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => { onAssign(p.id); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted"
            >
              {p.full_name || p.email}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}