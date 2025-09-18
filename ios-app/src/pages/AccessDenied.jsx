import { useNavigation } from '@react-navigation/native';
import { Button } from '../ui/button.tsx';

export default function AccessDenied() {
  const navigate = useNavigation();
  return (
    <div className="error-page bg-red-900 p-6">
      <h1>Access Denied</h1>
      <p>You don't have permission.</p>
      <Button onClick={() => navigate('/')} className="bg-red-500">Go Home</Button>
    </div>
  );
} 