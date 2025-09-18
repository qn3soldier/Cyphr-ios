import { useNavigate } from 'react-router-dom';
import { Button } from '@/ui/button';

export default function AccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="error-page bg-red-900 p-6">
      <h1>Access Denied</h1>
      <p>You don't have permission.</p>
      <Button onClick={() => navigate('/')} className="bg-red-500">Go Home</Button>
    </div>
  );
} 