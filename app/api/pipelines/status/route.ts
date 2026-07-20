import { NextRequest, NextResponse } from "next/server";
import { pipelineService } from "@/server/services/pipeline.service";


export async function GET(
req:NextRequest
){

const id =
req.nextUrl.searchParams.get("id");


if(!id){

return NextResponse.json({
error:"Missing job id"
},{
status:400
});

}


const status =
await pipelineService.status(id);


return NextResponse.json(status);


}