import * as Lucide from 'lucide-react';

const icons = [
    'Upload', 'TrendingUp', 'TrendingDown', 'Minus', 'Download', 'AlertCircle',
    'LayoutDashboard', 'Package', 'FileText', 'Settings', 'CheckCircle', 'Clock', 'XCircle', 'Filter'
];

icons.forEach(icon => {
    if (!Lucide[icon]) {
        console.error(`Icon ${icon} is MISSING from lucide-react`);
    } else {
        console.log(`Icon ${icon} is present`);
    }
});
