import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PropertyScorecardDetail from '@/components/scorecard/PropertyScorecardDetail';
import SeedOnMount from '../components/SeedOnMount';
import { useUserProfile } from '@/lib/UserProfileContext';

export default function HotelScorecard() {
  const { filterPropertiesForUser } = useUserProfile();

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