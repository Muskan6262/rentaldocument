import type { Meta, StoryObj } from '@storybook/react';
import { Greeting } from './Greeting';


const meta = {
    title: 'My Components/Greeting',
    component: Greeting,
    tags: ['autodocs'],
} satisfies Meta<typeof Greeting>;

export default meta;
type Story = StoryObj<typeof meta>;


export const Default: Story = {
    args: {
        name: 'Rahul',
        isPrimary: false,
    },
};


export const Primary: Story = {
    args: {
        name: 'Rahul',
        isPrimary: true,
    },
};
