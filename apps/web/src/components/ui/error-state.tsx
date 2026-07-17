import { Icon } from './icons';
export function ErrorState({ message }: { message: string }) { return <div className="ui-state ui-state--error" role="alert"><Icon name="warning" /><strong>Не вдалося завантажити дані</strong><span>{message}</span></div>; }
