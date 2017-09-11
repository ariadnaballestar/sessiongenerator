var simplemde = new SimpleMDE({
  spellChecker: false
});

$("#numColab").on("change paste keyup", function() {
  $( "#divColaboradores" ).empty();
  var maxCols = 30;
  var num = $(this).val();
  if (num <= maxCols) {
    for (var i = 1; i <= num; i++) {
      $( "#divColaboradores" ).append( $( `<div class="form-group"><label for="test">Colaborador numero ${i}</label><input type="text" class="form-control" id="test" name="colaboradores[${i}][title]" placeholder="Título (ej: Modelo:)" required><input type="text" class="form-control" id="test" name="colaboradores[${i}][name]" placeholder="Nombre" required><input type="text" class="form-control" id="test" name="colaboradores[${i}][link]" placeholder="Enlace (dejar en blanco si no procede)"></div>` ) );
    }
  } else {
    alert(`Máximo ${maxCols}.`)
  }
});

$("#infoForm").submit(function(e) {
    console.log('inside submit');
    $("#generateButton").prop("disabled", true);
    $("#content").val(simplemde.value());
});
