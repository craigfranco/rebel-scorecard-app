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
    };

    run().catch(() => {}); // silent fail if not authed yet
  }, []);

  return null;
}