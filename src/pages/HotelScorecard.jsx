import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PropertyScorecardDetail from '@/components/scorecard/PropertyScorecardDetail';
import SeedOnMount from '../components/SeedOnMount';
import { useUserProfile } from '@/lib/UserProfileContext';

export default function HotelScorecard() {
  const { filterPropertiesForUser } = useUserProfile();

  // Read propertyId from URL query param (e.g. ?propertyId=abc123)
  const urlParams = new URLSearchParams(window.location.search);
  const paramPropertyId = urlParams.get('propertyId');

  const [selectedPropertyId, setSelectedPropertyId] = useState(paramPropertyId || '');

  const { data: allProperties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 100),
  });

  const properties = filterPropertiesForUser(allProperties);
  const selectedProperty = properties.find(p => p.id === selectedPropertyId) || null;

  // Only fall back to first property if no param was provided and nothing is selected yet
  useEffect(() => {
    if (properties.length && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  // If a param was given but properties haven't loaded yet, set it once they do
  useEffect(() => {
    if (paramPropertyId && properties.length && selectedPropertyId !== paramPropertyId) {
      const exists = properties.find(p => p.id === paramPropertyId);
      if (exists) setSelectedPropertyId(paramPropertyId);
    }
  }, [paramPropertyId, properties]);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <SeedOnMount />
      <PropertyScorecardDetail
        property={selectedProperty}
        showPropertySelector
        properties={properties}
        selectedPropertyId={selectedPropertyId}
        onPropertyChange={setSelectedPropertyId}
      />
    </div>
  );
}