import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const UserProfileContext = createContext();

export const UserProfileProvider = ({ children }) => {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null); // 'not_found' | 'inactive' | null

  const loadProfile = useCallback(async () => {
    if (!isAuthenticated || !user?.email) {
      setIsLoadingProfile(false);
      return;
    }
    setIsLoadingProfile(true);
    setProfileError(null);
    try {
      const profiles = await base44.entities.UserProfile.filter({ email: user.email });
      if (!profiles || profiles.length === 0) {
        // Check if this is the default admin email — auto-create
        if (user.email === 'craig.franco@rebelhotelco.com') {
          const allProps = await base44.entities.Property.filter({ is_active: true }, 'name', 200);
          const newProfile = await base44.entities.UserProfile.create({
            email: user.email,
            full_name: user.full_name || 'Craig Franco',
            role: 'admin',
            assigned_properties: allProps.map(p => p.id),
            is_active: true,
            last_login: new Date().toISOString(),
          });
          setUserProfile(newProfile);
        } else {
          setProfileError('not_found');
        }
      } else {
        const profile = profiles[0];
        if (!profile.is_active) {
          setProfileError('inactive');
        } else {
          // Update last_login and mark active on first real login
          const updates = { last_login: new Date().toISOString() };
          if (profile.invite_status !== 'active') {
            updates.invite_status = 'active';
          }
          await base44.entities.UserProfile.update(profile.id, updates);
          setUserProfile({ ...profile, ...updates });
        }
      }
    } catch (e) {
      console.error('Failed to load user profile', e);
      setProfileError('not_found');
    }
    setIsLoadingProfile(false);
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isLoadingAuth) {
      loadProfile();
    }
  }, [isLoadingAuth, loadProfile]);

  const isAdmin = userProfile?.role === 'admin';
  const isViewer = userProfile?.role === 'viewer';
  const assignedProperties = userProfile?.assigned_properties || [];

  // Filter a list of properties down to only those the user can access
  // Admins and viewers see all properties; property_users see only assigned ones
  const filterPropertiesForUser = (properties) => {
    if (isAdmin || isViewer) return properties;
    return properties.filter(p => assignedProperties.includes(p.id));
  };

  return (
    <UserProfileContext.Provider value={{
      userProfile,
      isLoadingProfile,
      profileError,
      isAdmin,
      isViewer,
      assignedProperties,
      filterPropertiesForUser,
      reloadProfile: loadProfile,
    }}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (!context) throw new Error('useUserProfile must be used within UserProfileProvider');
  return context;
};