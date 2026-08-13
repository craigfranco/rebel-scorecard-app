import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PropertyScorecardDetail from '@/components/scorecard/PropertyScorecardDetail';
import SeedOnMount from '../components/SeedOnMount';
import { useUserProfile } from '@/lib/UserProfileContext';
import { useTimePeriod } from '@/lib/TimePeriodContext';

export default function HotelScorecard() {
  const { filterPropertiesForUser } = useUserProfile();
  const { getPeriodLabel } = useTimePeriod();

  const urlParams = new URLSearchParams(window.location.search);
  const paramPropertyId = urlParams.get('propertyId');

  const [selectedPropertyId, setSelectedPropertyId] = useState(paramPropertyId || '');

  const { data: rawProperties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 100),
  });
  const properties = filterPropertiesForUser(rawProperties);

  // Keep the selected hotel within the set
  useEffect(() => {
    if (!properties.length) return;
    const exists = properties.find(p => p.id === selectedPropertyId);
    if (!exists) setSelectedPropertyId(properties[0].id);
  }, [properties, selectedPropertyId]);

  useEffect(() => {
    if (paramPropertyId && properties.length && selectedPropertyId !== paramPropertyId) {
      const exists = properties.find(p => p.id === paramPropertyId);
      if (exists) setSelectedPropertyId(paramPropertyId);
    }
  }, [paramPropertyId, properties]);

  const selectedProperty =
    properties.find(p => p.id === selectedPropertyId) || null;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <SeedOnMount />

      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <h1 className="text-2xl font-bold">Hotel Performance Scorecard</h1>
        <p className="text-white/70 text-sm mt-1">Portfolio summary & per-hotel scorecard — {getPeriodLabel()}</p>
      </div>

      {/* Selected hotel full scorecard */}
      <PropertyScorecardDetail
        property={selectedProperty}
        showPropertySelector={properties.length > 1}
        properties={properties}
        selectedPropertyId={selectedPropertyId}
        onPropertyChange={setSelectedPropertyId}
      />
    </div>
  );
}