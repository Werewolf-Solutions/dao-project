import { useRouteError, useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

interface RouteError {
  status?: number;
  statusText?: string;
  message?: string;
}

export default function ErrorPage() {
  const error = useRouteError() as RouteError;
  const navigate = useNavigate();
  const { theme } = useTheme();

  const status = error?.status;
  const message = error?.statusText ?? error?.message ?? 'An unexpected error occurred.';

  return (
    <PageContainer centered maxWidth="sm">
      <Card className="text-center">
        <h1 className="text-6xl font-bold text-accent mb-2">{status ?? 'Error'}</h1>
        <h2 className="text-2xl font-semibold mb-2">Something went wrong</h2>
        <p className={`text-sm ${theme.textMuted} mb-6`}>{message}</p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={() => navigate(-1)}>Go Back</Button>
          <Button variant="primary" onClick={() => navigate('/')}>Home</Button>
        </div>
      </Card>
    </PageContainer>
  );
}
