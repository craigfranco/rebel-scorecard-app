import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { HOTELS, getGssForBrand } from '../lib/hotels';

/**
 * Silently seeds the 25 real hotels on first app load if no properties exist yet.
 */
export default function SeedOnMount() {
  const queryClient = useQueryClient();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;

    const run = async () => {
      const existing = await base44.entities.Property.list('name', 5);
      if (existing.length > 0) return; // already seeded

      for (const hotel of HOTELS) {
        const gss = getGssForBrand(hotel.parent_brand);
        await base44.entities.Property.create({ ...hotel, ...gss, is_active: true });
      }
      queryClient.invalidateQueries({ queryKey: ['properties'] });

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