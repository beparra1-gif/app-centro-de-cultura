function SkeletonLoaderPanel() {
  return (
    <div className="skeleton-container fade-in" style={{ padding: '15px' }}>
      <div className="skeleton-header" style={{ height: '30px', width: '50%', background: 'rgba(0,0,0,0.05)', borderRadius: '999px', marginBottom: '20px' }}></div>
      <div className="skeleton-card" style={{ height: '150px', background: 'rgba(0,0,0,0.05)', borderRadius: '24px', marginBottom: '15px' }}></div>
      <div className="skeleton-card" style={{ height: '100px', background: 'rgba(0,0,0,0.05)', borderRadius: '24px', marginBottom: '15px' }}></div>
      <div className="skeleton-card" style={{ height: '200px', background: 'rgba(0,0,0,0.05)', borderRadius: '24px' }}></div>
    </div>
  );
}

export default SkeletonLoaderPanel;
