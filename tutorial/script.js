document.addEventListener("DOMContentLoaded", () => {
  const slides = document.querySelectorAll(".slide-card");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const pageDots = document.getElementById("page-dots");
  
  const viewDeckBtn = document.getElementById("view-deck-btn");
  const viewGridBtn = document.getElementById("view-grid-btn");
  const viewTableBtn = document.getElementById("view-table-btn");
  const printBtn = document.getElementById("print-btn");
  
  const slidesContainer = document.getElementById("slides-container");
  const tableContainer = document.getElementById("table-container");
  const phaseFilters = document.querySelectorAll(".phase-filter");
  
  let currentSlideIndex = 0;
  let currentView = "deck"; // "deck" | "grid" | "table"

  // 1. Slide Deck Navigation
  function updateSlideVisibility() {
    if (currentView !== "deck") return;
    
    slides.forEach((slide, index) => {
      if (index === currentSlideIndex) {
        slide.classList.add("active");
        slide.classList.add("in-view");
        slide.style.display = "block";
      } else {
        slide.classList.remove("active");
        slide.classList.remove("in-view");
        slide.style.display = "none";
      }
    });
    
    pageDots.textContent = `第 ${currentSlideIndex + 1} / ${slides.length} 頁`;
    prevBtn.disabled = currentSlideIndex === 0;
    nextBtn.disabled = currentSlideIndex === slides.length - 1;
  }

  prevBtn.addEventListener("click", () => {
    if (currentSlideIndex > 0) {
      currentSlideIndex--;
      updateSlideVisibility();
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentSlideIndex < slides.length - 1) {
      currentSlideIndex++;
      updateSlideVisibility();
    }
  });

  // 2. View Switching
  viewDeckBtn.addEventListener("click", () => {
    currentView = "deck";
    setActiveViewBtn(viewDeckBtn);
    
    // Reset wrapper layout
    slidesContainer.style.display = "flex";
    slidesContainer.classList.remove("postit-grid");
    slidesContainer.style.flexDirection = "column";
    tableContainer.style.display = "none";
    
    document.querySelector("footer").style.display = "flex";
    
    applyFilters();
    updateSlideVisibility();
  });

  viewGridBtn.addEventListener("click", () => {
    currentView = "grid";
    setActiveViewBtn(viewGridBtn);
    
    // Set grid layout
    slidesContainer.style.display = "grid";
    slidesContainer.style.gridTemplateColumns = "repeat(auto-fit, minmax(320px, 1fr))";
    slidesContainer.style.gap = "2rem";
    tableContainer.style.display = "none";
    
    document.querySelector("footer").style.display = "none";
    
    // Show all filtered slides
    applyFilters();
  });

  viewTableBtn.addEventListener("click", () => {
    currentView = "table";
    setActiveViewBtn(viewTableBtn);
    
    slidesContainer.style.display = "none";
    tableContainer.style.display = "block";
    
    document.querySelector("footer").style.display = "none";
  });

  function setActiveViewBtn(activeBtn) {
    [viewDeckBtn, viewGridBtn, viewTableBtn].forEach(btn => {
      btn.classList.remove("active");
    });
    activeBtn.classList.add("active");
  }

  // 3. Print / PDF Export
  printBtn.addEventListener("click", () => {
    // Before printing, force all cards to show so the print styles work on all slides
    const tempView = currentView;
    
    // Set to grid/print friendly display state temporary
    slides.forEach(slide => {
      slide.style.display = "block";
      slide.classList.add("in-view");
    });
    tableContainer.style.display = "block"; // also print the table at the end
    
    window.print();
    
    // Restore state after print dialog finishes
    setTimeout(() => {
      if (tempView === "deck") {
        tableContainer.style.display = "none";
        updateSlideVisibility();
      } else if (tempView === "grid") {
        tableContainer.style.display = "none";
        applyFilters();
      } else {
        slidesContainer.style.display = "none";
      }
    }, 1000);
  });

  // 4. Filtering logic
  phaseFilters.forEach(checkbox => {
    checkbox.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "all") {
        phaseFilters.forEach(cb => {
          cb.checked = e.target.checked;
        });
      } else {
        // If uncheck any, uncheck "all"
        if (!e.target.checked) {
          document.querySelector('.phase-filter[value="all"]').checked = false;
        }
      }
      applyFilters();
    });
  });

  function applyFilters() {
    const checkedPhases = Array.from(phaseFilters)
      .filter(cb => cb.checked && cb.value !== "all")
      .map(cb => cb.value);
      
    if (currentView === "grid") {
      slides.forEach(slide => {
        const slidePhase = slide.getAttribute("data-phase");
        if (checkedPhases.includes(slidePhase)) {
          slide.style.display = "block";
          slide.classList.add("in-view");
        } else {
          slide.style.display = "none";
          slide.classList.remove("in-view");
        }
      });
    } else if (currentView === "deck") {
      slides.forEach((slide, index) => {
        if (index === currentSlideIndex) {
          slide.style.display = "block";
        } else {
          slide.style.display = "none";
        }
      });
    }
  }

  // Initial setup
  updateSlideVisibility();
});
