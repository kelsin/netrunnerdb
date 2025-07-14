$(document).on("data.app", function () {
    var sets_in_cube = {};
    NRDB.data.cards.find().forEach(function (card) {
        var incube = 0;
        if (SelectedCube.slots[card.code]) {
            incube = parseInt(SelectedCube.slots[card.code], 10);
            sets_in_cube[card.pack_code] = 1;
        }
        NRDB.data.cards.updateById(card.code, {
            incube: incube,
            factioncost: card.factioncost || 0,
        });
    });

    MWL = SelectedCube.code && NRDB.data.mwl.findById(SelectedCube.code);

    update_cube();

    make_cube_cost_graph();
    make_cube_strength_graph();
});

function do_action_cube(event) {
    var action_id = $(this).attr("id");
    if (!action_id || !SelectedCube) return;
    switch (action_id) {
        case "btn-edit":
            location.href = Routing.generate("cube_edit", {
                cube_uuid: SelectedCube.uuid,
            });
            break;
        case "btn-publish":
            show_publish_cube_form(
                SelectedCube.uuid,
                SelectedCube.name,
                SelectedCube.description,
            );
            break;
        case "btn-delete":
            confirm_delete();
            break;
        case "btn-download-text":
            location.href = Routing.generate("cube_export_text", {
                cube_uuid: SelectedCube.uuid,
            });
            break;
        case "btn-print":
            window.print();
            break;
        case "btn-sort-type":
            DisplaySort = "type";
            DisplaySortSecondary = null;
            switch_to_web_view();
            break;
        case "btn-sort-number":
            DisplaySort = "number";
            DisplaySortSecondary = null;
            switch_to_web_view();
            break;
        case "btn-sort-faction":
            DisplaySort = "faction";
            DisplaySortSecondary = null;
            switch_to_web_view();
            break;
        case "btn-sort-faction-type":
            DisplaySort = "faction";
            DisplaySortSecondary = "type";
            switch_to_web_view();
            break;
        case "btn-sort-faction-number":
            DisplaySort = "faction";
            DisplaySortSecondary = "number";
            switch_to_web_view();
            break;
        case "btn-sort-title":
            DisplaySort = "title";
            DisplaySortSecondary = null;
            switch_to_web_view();
            break;
        case "btn-display-plain":
            export_plaintext();
            break;
        case "btn-display-bbcode":
            export_bbcode();
            break;
        case "btn-display-markdown":
            export_markdown();
            break;
        case "btn-display-jintekinet":
            export_jintekinet();
            break;
        case "btn-export-tournament-sheet":
            open_cubelist_modal(
                SelectedCube.uuid,
                SelectedCube.side_name.charAt(0).toUpperCase() +
                    SelectedCube.side_name.slice(1),
            );
            break;
        case "btn-pnp":
            location.href = Routing.generate("cube_print", {
                cube_uuid: SelectedCube.uuid,
                _locale: NRDB.locale,
            });
            break;
    }
}

$(function () {
    $("#cardModal").on({
        keypress: function (event) {
            var num = parseInt(event.which, 10) - 48;
            $(".modal input[type=radio][value=" + num + "]").trigger("change");
        },
    });

    var converter = new Markdown.Converter();
    $("#description").html(
        DOMPurify.sanitize(
            converter.makeHtml(
                SelectedCube.description
                    ? SelectedCube.description
                    : "<i>No description.</i>",
            ),
        ),
    );

    $(".btn-actions").on(
        {
            click: do_action_cube,
        },
        "button[id],a[id]",
    );

    $("#btn-publish").prop("disabled", !!SelectedCube.problem);
});

function confirm_delete() {
    $("#delete-cube-name").text(SelectedCube.name);
    $("#delete-cube-uuid").val(SelectedCube.uuid);
    $("#deleteModal").modal("show");
}

function switch_to_web_view() {
    $("#cube").html(
        '<div class="row"><div class="col-sm-12"><h3 id="identity"></h3><div id="influence"></div><div id="agendapoints"></div><div id="cardcount"></div><div id="latestpack"></div><div id="restricted"></div><div id="limited"></div></div></div><div class="row" id="cube-content" style="margin-bottom:10px"></div>',
    );
    update_cube();
}
