import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { HOTELS, getGssForBrand } from '../lib/hotels';
import { useAuth } from '@/lib/AuthContext';

/**
 * Silently seeds the 25 real hotels on first app load if no properties exist yet.
 */
export default function SeedOnMount() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;

    const run = async () => {
      // Clean corrupted staff records (old auto-fill bug)
      try {
        const allStaff = await base44.entities.Staff.list('name', 500);
        for (const staff of allStaff) {
          const q1 = parseFloat(staff.salary_q1) || 0;
          const q2 = parseFloat(staff.salary_q2) || 0;
          
          // Detect corruption: if salary_q2 ≈ salary_q1/4, null it out
          if (q1 > 0 && q2 > 0 && Math.abs(q2 - q1 / 4) < 1) {
            await base44.entities.Staff.update(staff.id, {
              salary_q2: null,
              salary_q3: null,
              salary_q4: null,
            });
          }
        }
      } catch (e) {
        // Silently continue if cleanup fails
      }

      const existing = await base44.entities.Property.list('name', 5);
      if (existing.length > 0) return; // already seeded

      for (const hotel of HOTELS) {
        const gss = getGssForBrand(hotel.parent_brand);
        await base44.entities.Property.create({ ...hotel, ...gss, is_active: true });
      }
      queryClient.invalidateQueries({ queryKey: ['properties'] });

      // Seed default admin UserProfile for craig.franco@rebelhotelco.com
      try {
        const existingProfiles = await base44.entities.UserProfile.filter({ email: 'craig.franco@rebelhotelco.com' });
        if (existingProfiles.length === 0) {
          const allProps = await base44.entities.Property.list('name', 200);
          await base44.entities.UserProfile.create({
            email: 'craig.franco@rebelhotelco.com',
            full_name: 'Craig Franco',
            role: 'admin',
            assigned_properties: allProps.map(p => p.id),
            is_active: true,
          });
          queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
        }
      } catch (e) { /* silent */ }

      // Seed job classifications
      const existingJobs = await base44.entities.JobClassification.list('title', 5);
      if (existingJobs.length === 0) {
        const jobs = [
          {
            title: 'General Manager',
            max_bonus_percentage: 50,
            gop_bonus_percentage: 10,
            gop_margin_bonus_percentage: 10,
            rgi_bonus_percentage_low: 7.5,
            rgi_bonus_percentage_high: 15,
            gss_bonus_percentage: 15,
          },
          {
            title: 'Asst. General Manager / EC Member',
            max_bonus_percentage: 40,
            gop_bonus_percentage: 10,
            gop_margin_bonus_percentage: 10,
            rgi_bonus_percentage_low: 5,
            rgi_bonus_percentage_high: 10,
            gss_bonus_percentage: 10,
          },
          {
            title: 'Department Heads',
            max_bonus_percentage: 20,
            gop_bonus_percentage: 5,
            gop_margin_bonus_percentage: 5,
            rgi_bonus_percentage_low: 2,
            rgi_bonus_percentage_high: 5,
            gss_bonus_percentage: 8,
          },
        ];
        for (const job of jobs) {
          await base44.entities.JobClassification.create(job);
        }
        queryClient.invalidateQueries({ queryKey: ['job-classifications'] });
      }
    };

    run().catch(() => {}); // silent fail if not authed yet
  }, []);

  return null;
}