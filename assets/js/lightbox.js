document.addEventListener('DOMContentLoaded', function() {
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  document.body.appendChild(lightbox);

  document.querySelectorAll('.zoom-image').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const img = document.createElement('img');
      img.src = this.href;
      lightbox.innerHTML = '';
      lightbox.appendChild(img);
      lightbox.style.display = 'block';
    });
  });

  lightbox.addEventListener('click', function() {
    this.style.display = 'none';
  });
});