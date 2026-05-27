import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/documents', { replace: true }); }, []);
  return null;
}