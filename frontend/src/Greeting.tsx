
interface GreetingProps {
    name: string;
    isPrimary?: boolean;
}

export const Greeting = ({ name, isPrimary = false }: GreetingProps) => {
    return (
        <div style={{
            padding: '20px',
            backgroundColor: isPrimary ? '#007bff' : '#f0f0f0',
            color: isPrimary ? 'white' : 'black',
            borderRadius: '8px',
            textAlign: 'center'
        }}>
            <h2>Hello, {name}! 👋</h2>
        </div>
    );
};
