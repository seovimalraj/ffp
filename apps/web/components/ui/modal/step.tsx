import React from 'react'

interface StepProps {
    currentStep: number;
    step: number;
    children: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ currentStep, step, children }) => {
    const isActive = currentStep === step;
    
    if (!isActive) {
        return null;
    }
    
    return <>{children}</>;
}
export default Step
