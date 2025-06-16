// eslint-disable-next-line import/no-cycle
import { sampleRUM } from './lib-franklin.js';
import AdobeLaunch from '../lib/scripts/adobe-launch.js';
import AnalyticsService from '../lib/scripts/analytics/index.js';

// Core Web Vitals RUM collection
sampleRUM('cwv');

try {
    const manager = new AdobeLaunch();
    await manager.setEndpoint();

    const service = new AnalyticsService();
    const Analytics = await service.getImplementation();

    const analytics = new Analytics(manager);
    await analytics.initialize({
        platform: 'aem franklin - v0.1.0',
    });

    manager.initialize();
} catch (e) {
    // eslint-disable-next-line no-console
    console.log(e.message);
}